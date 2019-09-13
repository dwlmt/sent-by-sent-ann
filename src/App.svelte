<script>
    import annotations_source from '../static/annotations_source.json';
    import annotations_source_gold from '../static/annotations_source_gold.json';

    import firebase from 'firebase/app';
    import 'firebase/auth';
    import 'firebase/firestore';

      // Your web app's Firebase configuration
      var firebaseConfig = {
        apiKey: "AIzaSyAKf2f2hZW0HUbtnGMxxEn0rjdAggKpBpw",
        authDomain: "story-sent-by-sent-annotations.firebaseapp.com",
        databaseURL: "https://story-sent-by-sent-annotations.firebaseio.com",
        projectId: "story-sent-by-sent-annotations",
        storageBucket: "",
        messagingSenderId: "957227500629",
        appId: "1:957227500629:web:8fad65731aa2e7370cc0dc"
      };
      // Initialize Firebase
      firebase.initializeApp(firebaseConfig);

    let db = firebase.firestore();
    let db_collection = "sentence_annotations_gold_test";

    $: valid_story = true;

    let summary_question = "";
    let thought_question = "";
    let min_text_length = 25;
    let rating_question = 0;
    let assignment_id = null;
    let hit_id = null;
    let turk_submit_to = null;
    let worker_id = null;
    let min_duration = 500;

    let annotations_lookup = new Map();
    for (const s of annotations_source.stories) {
        annotations_lookup[String(s.story_id)] = s;
    }
    for (const s of annotations_source_gold.stories) {
            annotations_lookup[String(s.story_id)] = s;
            console.log(s)
    }

    import { writable } from 'svelte/store';
    export const story_annotations = writable([]);


	$: active_story_id = -1;
	$: code = -1;
	$: last_choice = 0;
	$: trainer = false;
	$: sentence_correct = true;
	$: correct_count = 0;
	$: active_story_complete = false;
	$: workflow_state = "INSTRUCTIONS";
	$: show_annotations = false;

	$: start_timer = new Date().getTime();
	$: whole_task_timer = new Date().getTime();

	$: active_story_sentences = [];
    $: active_sentence_index = 0;
    $: active_sentence = null;

    function moveNext() {
         sentence_correct = true;
         if (active_sentence_index + 1 === active_story_sentences.length) {
                        active_story_complete = true;
                        workflow_state = "SUMMARY"
         }

         active_sentence_index = Math.min(active_sentence_index + 1, active_story_sentences.length - 1);
         active_sentence = active_story_sentences[active_sentence_index];
         last_choice = choice;

         start_timer = new Date().getTime();
    }

    function sentenceChoice(choice, interaction_type="button") {

        let duration = new Date().getTime() - start_timer;

        if (duration > min_duration){

            let annotation_result_map = {"story_id": active_story_id, "suspense": choice, "duration_milliseconds": duration};
            annotation_result_map["sentence_num"] = active_sentence["sentence_num"];
            annotation_result_map["sentence_id"] = active_sentence["sentence_id"];
            annotation_result_map["sentence_len"] = active_sentence["sentence_len"];
            annotation_result_map["interaction_type"] = interaction_type;

            if (trainer === true) {
                annotation_result_map["gold_answer"]  = active_sentence["gold_answer"];
                annotation_result_map["correct"] =  choice === active_sentence["gold_answer"];

            }

             if (active_story_complete === false) {
                console.log(`Annotations: ${annotation_result_map}`);
                story_annotations.update(n => n.concat([annotation_result_map]));
             }

             if (annotation_result_map["correct"] === true) {
                 correct_count += 1;
                 sentence_correct = true;
                 moveNext();
             } else{
                 sentence_correct = false;
             }
        }
    }

    function undoAnnotation() {

        if (trainer === false) {
            let duration = new Date().getTime() - start_timer;
            if (duration > min_duration){
                 if (active_story_complete === false) {
                            story_annotations.update(n => {
                                active_sentence_index -= 1
                                active_sentence = active_story_sentences[active_sentence_index];
                                return n.slice(0, -1);
                            })
                         }
                }

                start_timer = new Date().getTime();

        }
    }

    function post(path, params, method='post') {

      // The rest of this code assumes you are not using a library.
      // It can be made less wordy if you use one.
      const form = document.createElement('form');
      form.method = method;
      form.action = path;

      for (const key in params) {
          const hiddenField = document.createElement('input');
          hiddenField.type = 'hidden';
          hiddenField.name = key;
          hiddenField.value = params[key];

          form.appendChild(hiddenField);
      }

      document.body.appendChild(form);
      form.submit();
    }

    function startStoryAnnotation() {
        let query_params = new URLSearchParams(window.location.search);

        let mturk_code = query_params.get("mturkCode");

        if (mturk_code != null && mturk_code.length > 0)     {
            let split_params = mturk_code.split("-");
            active_story_id = split_params[0];
            code = split_params[1];
        } else {
             active_story_id = query_params.get("story_id");
             code = query_params.get("code");
        }

        if (String(active_story_id) in annotations_lookup){
            let story = annotations_lookup[active_story_id];

            if ("trainer" in story && story.trainer === true) {
                trainer = true;
            }
            active_story_sentences = story["sentences"];
            active_sentence = active_story_sentences[active_sentence_index];

            if (code === story.code) {
                workflow_state = "ANNOTATE";
            } else {
                workflow_state = "INVALID_STORY";
            }

             assignment_id = query_params.get("assignmentId");
             hit_id = query_params.get("hitId");
             turk_submit_to = query_params.get("turkSubmitTo");
             worker_id = query_params.get("workerId");

            start_timer = new Date().getTime();
            whole_task_timer = new Date().getTime();
        }
    }

    function submitStoryAnnotation() {
        if (thought_question.length >= min_text_length && summary_question.length >= min_text_length && rating_question > 0){

            let comp_annotations = new Object();
            comp_annotations["story_id"] = active_story_id;
            comp_annotations["summary_question"] = summary_question;
            comp_annotations["thought_question"] = thought_question;
            comp_annotations["rating_question"] = rating_question;

            if (assignment_id != null && assignment_id.length > 0) {
                comp_annotations["assignment_id"] = assignment_id;
            }
            if (hit_id != null && hit_id.length > 0) {
                comp_annotations["hit_id"] = hit_id;
            }
            if (worker_id != null && worker_id.length > 0) {
                comp_annotations["worker_id"] = worker_id;
            }
            comp_annotations["sentence_annotations"] = $story_annotations;
            comp_annotations["task_duration_milliseconds"] = new Date().getTime() - whole_task_timer;

            console.log(comp_annotations);

            db.collection(db_collection).add(comp_annotations)
            .then(function(docRef) {
                console.log("Document written with ID: ", docRef.id);

                if (turk_submit_to != null && turk_submit_to.length > 0) {
                    res_map = {"assignmentId": assignment_id, "docRefId": docRef.id, "collection": db_collection};
                    if(training === true) {
                        // Remove one as the first sentence is always the default.
                        res_map["correct_score"] = (correct_count - 1)/(active_story_sentences.length - 1);
                    }
                    console.log(turk_submit_to, res_map);
                    post(turk_submit_to, "/mturk/externalSubmit", res_map);
                } else {
                    workflow_state = "COMPLETE";
                }
            })
            .catch(function(error) {
                console.error("Error adding document: ", error);
            });
        }
     }

    function handleKey(event) {
        if (workflow_state === "ANNOTATE") {
            if  (event.key === "a" || event.key === "A" ) {
                sentenceChoice(1,"key")
            }
            else if  (event.key === "s" || event.key === "S") {
                sentenceChoice(2,"key")
            }
            else if  (event.key === "k" || event.key === "K") {
                sentenceChoice(4,"key")
            }
            else if  (event.key === "l" || event.key === "L") {
                sentenceChoice(5,"key")
            }
            else if  (event.key === "u" || event.key === "U") {
                if (active_sentence_index > 1) {
                    undoAnnotation()
                }
            }
            else if  (event.key === "n" || event.key === "N") {
                sentenceChoice(0,"key")
                        }
            else if  (event.key === " ") {
                  sentenceChoice(3,"key")
            }
        }

    }
    function submitForm()
    {
      return false;
    }

</script>

<style>
</style>

<link rel="stylesheet" href="//fonts.googleapis.com/css?family=Roboto:min_text_length0,min_text_length0italic,700,700italic">

<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/normalize/5.0.0/normalize.css">

<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/milligram/1.3.0/milligram.css">

<svelte:window on:keyup={handleKey}/>

{#if workflow_state === "INVALID_STORY"}
<div id="sentence">
    <h2>Invalid Story</h2>
    <p>
    <strong>The story is not recognised. </strong>

</div>

{:else if workflow_state === "INSTRUCTIONS"}
<div id="sentence">


      <button on:click={startStoryAnnotation}>Start</button>

    <h2>Story Reading Sentence by Sentence</h2>
    <p>  You will read a short story and for each sentence be asked to assess how the dramatic tension increases, decreases or stays the same. Each story will take an estimated
    <emph>5-7 minutes</emph>.Judge each sentence on how the dramatic tension has changed over as felt by the main characters in the story, not
    what you as a reader feel. This tension is the excitement or anxiousness over what will happen to the characters next, it is antipation.</p>
    <p>
     <strong>An Example:</strong> Take a dramatic moment in a story main such as a character that needs to walk along a dangerous cliff path. When the character first realises they will encounter danger the tension
     will rise. As they are on the cliff ledge then tension will increase further. Other details such as falling rocks or slips will increase the tension further to a peak. When the cliff edge
     has been navigated safely the tension will drop. The pattern will be the same with a dramatic event such as a fight, argument, accident, romantic moment, where the tension will rise to a peak
     and then fall away as the tension is resolved.
     </p>

     <p>Increasing levels of each of the following increase the level of dramatic tension:</p>
        <ul>
         <li><strong>Uncertainty:</strong> How uncertain are the characters involved about what will happen next? Put yourself in the characters shoes; judge the change in the tension based on how the characters perceive the situation.  </li>
         <li><strong>Significance:</strong>How significant are the consequences of what will happen to the central characters of the story.</li>
        </ul>
    <p>Keyboard shortcuts are shown in brackets and will enable you to speed up the annotation process.
    The scale has 5 choices:
    </p>
    <ul>
      <li><strong>Big Decrease (A):</strong> A sudden dramatic decrease in dramatic tension of the situation. In the cliff example the person reaching the other side safely.</li>
      <li><strong>Decrease (S):</strong> A slow decrease in the level of tension, a more gradual drop. For example the cliff walker sees an easier route out. </li>
      <li><strong>Same (Space):</strong> Stays at a similar level. In the cliff example an ongoing description of the event.</li>
      <li><strong>Increase (K):</strong> A gradual increase in the tension. Loose rocks fall nearby the cliff walker.</li>
      <li><strong>Big Increase (L):</strong> A more sudden dramatic increase such as an argument. The cliff walker suddenly slips and falls. </li>
       </ul>

    <h4>Example Story</h4>

    <p>An example story with guidance answers:</p>

     <table>
        <tr><th>Judgement</th><th>Sentence Number</th><th>Text</th></tr>
        <tr><td>NA</td><td>0</td><td>Clancy Marguerian , 154 , private first class of the 150 + army , sits in his foxhole .</td></tr>
        <tr><td>Increase</td><td>1</td><td>Tired cold , wet and hungry , the only thing preventing him from laying down his rifle and walking towards the enemy lines in surrender is the knowledge that however bad he has it here , life as a 50 - 100 POW is surely much worse .</td></tr>
        <tr><td>Increase</td><td>2</td><td>He &#39;s fighting to keep his eyes open and his rifle ready when the mortar shells start landing near him .</td></tr>
        <tr><td>Same</td><td>3</td><td>He hunkers lower .</td></tr>
        <tr><td>Increase</td><td>4</td><td>After a few minutes under the barrage , Marguerian hears hurried footsteps , a grunt , and a thud as a soldier leaps into the foxhole .</td></tr>
        <tr><td>Same</td><td>5</td><td>The man &#39;s uniform is tan , he must be a 50 - 100 .</td></tr>
        <tr><td>Big Increase</td><td>6</td><td>The two men snarl and grab at eachother , grappling in the small foxhole .</td></tr>
        <tr><td>Same</td><td>7</td><td>Abruptly , their faces come together .</td></tr>
        <tr><td>Decrease</td><td>8</td><td>`` Clancy ? &#39;&#39;</td></tr>
        <tr><td>Decrease</td><td>9</td><td>`` Rob ? &#39;&#39;</td></tr>
        <tr><td>Big Decrease</td><td>10</td><td>Rob Hall , 97 , Corporal in the 50 - 100 army grins , as the situation turns from life or death struggle , to a meeting of two college friends .</td></tr>
        <tr><td>Decrease</td><td>11</td><td>He lets go of Marguerian &#39;s collar .</td></tr>
        <tr><td>Same</td><td>12</td><td>`` Holy shit Clancy , you &#39;re the last person I expected to see here &#39;&#39;</td></tr>
        <tr><td>Same</td><td>13</td><td>`` Yeah &#39;&#39; `` Shit man , I did n&#39;t think I &#39;d ever see &#39;</td></tr>
        <tr><td>Same</td><td>14</td><td>Mr .</td></tr>
        <tr><td>Decrease</td><td>15</td><td>volunteers every saturday morning at the food shelf &#39; , not after The Reorganization at least &#39;&#39;</td></tr>
        <tr><td>Same</td><td>17</td><td>Yeah Rob , it is something is n&#39;t it &#39;&#39;</td></tr>
        <tr><td>Decrease</td><td>18</td><td>`` Man , I &#39; m sorry</td></tr>
        <tr><td>Same</td><td>19</td><td>I tried to kill you there ,</td></tr>
        <tr><td>Same</td><td>20</td><td>hey , I heard you guys were out of food , here , you can share my dinner &#39;&#39; Clancy marvels , even after all this : The Reorganization , the coalitions , the war , Rob is still his old , chatty self .</td></tr>
        <tr><td>Same</td><td>21</td><td>The two men sit , Rob chatting away , Clancy forcing out pleasantries .</td></tr>
        <tr><td>Same</td><td>22</td><td>They pass Rob &#39;s rations between them .</td></tr>
        <tr><td>Increase</td><td>23</td><td>`` Clancy my man , I heard a group of terrorist 5 &#39;s took have formed some kind of cult , and they &#39;re rallying all the &lt; 50 in their own coalition &#39;&#39;</td></tr>
        <tr><td>Same</td><td>24</td><td>`` Oh yeah ? &#39;&#39;</td></tr>
        <tr><td>Decrease</td><td>25</td><td>`` Yeah , I mean , that sucks and everything , cause those are some scary dudes , but I heard that there &#39;s going to be a truce between our countries in a few days , why do n&#39;t we just hang out here , pretty soon we wo n&#39;t even be enemies anymore ! &#39;&#39;</td></tr>
        <tr><td>Same</td><td>26</td><td>`` Yeah , Rob , that sounds like a plan &#39;&#39;</td></tr>
        <tr><td>Increase</td><td>27</td><td>`` Man , I &#39; m so glad I found you again , in a few days , this war will be over , and things will be cool between us and , hey , remember Sarah ?</td></tr>
        <tr><td>Same</td><td>28</td><td>I heard she &#39;s a 151 , maybe I &#39;ll look her up , I &#39;ll be sure to visit you too once I can get a pass to sector 150 - 155 , it &#39;ll probably be tough though , even before the war</td></tr>
        <tr><td>Same</td><td>29</td><td>, you had to do sooo much paperwork to be allowed to visit , I wonder if passes will even be reinstated after the truce ends , hey , did I ever tell you about the time ... &#39;&#39;</td></tr>
        <tr><td>Increase</td><td>30</td><td>Rob babbles as he dozes off , grinning up at Clancy .</td></tr>
        <tr><td>Big Increase</td><td>31</td><td>When Clancy is sure that his friend is asleep , he slits Rob &#39;s throat with his bayonet .</td></tr>
        <tr><td>Decrease</td><td>32</td><td>Clancy climbs out of the foxhole , and stumbles his way back to battalion HQ .</td></tr></table>


</div>
{:else if workflow_state === "SUMMARY"}
<div id="sentence">
    <h2>Review Questions</h2>

        <p>The following review questions are assess the story overall:</p>
        <ul>
          <li><strong>Summary: </strong> Write a short one or two sentence summary of what the story is about. This should mention the main character(s),
          plot points, goals or obstacles that the characters overcame in the story.</li>
          <li><strong>Review:</strong> Write a couple of sentences reviewing the story saying what you like or don't like about it and why. For either mention if it is the topic, characters, plot,
          etc that draw you into the story or find uninteresting</li>
          <li><strong>Rating:</strong> A 5 point scale from very uninteresting to very interesting. Just go with your own judgement on how interesting the story is.</li>
        </ul>

    <p>
    <h4>Please write a summary of the story in one or two sentences.</h4>
    <form onsubmit="event.preventDefault();">
    <p>
     <textarea rows = "3" cols = "100" name = "summary" id="summary" bind:value={summary_question}></textarea>
    <p>
        <h4>Do you think the story is interesting or not? And why? One or two sentences.</h4>

    <p>
      <textarea rows = "3" cols = "100" name = "thoughts" id="thoughts" bind:value={thought_question}></textarea>
     <p>
        <h4>How interesting is the story?</h4>
     <p>
     <label><input type=radio bind:group={rating_question} value={1}>1 - Very Uninteresting</label>
     <label><input type=radio bind:group={rating_question} value={2}>2 - Uninteresting</label>
     <label><input type=radio bind:group={rating_question} value={3}>3 - Okay</label>
     <label><input type=radio bind:group={rating_question} value={4}>4 - Interesting</label>
     <label><input type=radio bind:group={rating_question} value={5}>5 - Very Interesting</label>
     <p>
     <button disabled={thought_question.length < min_text_length || summary_question.length < min_text_length || rating_question === 0} on:click={submitStoryAnnotation}>Submit</button>

     </form>
</div>
{:else if workflow_state === "ANNOTATE"}

<h1>Story: {active_story_id} </h1>

<div id="sentence">
    <h4>{active_sentence["text"]}</h4>

    {#if trainer === true && sentence_correct === false}
    <div id="trainer_feedback">
    <p></p>
    <h4>Incorrect answer: {active_sentence["gold_explanation"]}</h4>
    <p><button on:click={moveNext}>Next</button></p>
    </div>
    {/if}
    <p>
    <strong>{active_sentence_index + 1}/{active_story_sentences.length}</strong>
</p>
</div>

<div id="sentence_buttons">

{#if active_sentence_index > 0}
    <button on:click={()=>sentenceChoice(1,"button")}>Big Decrease (A)</button>
    <button on:click={()=>sentenceChoice(2,"button")}>Decrease (S)</button>
    <button on:click={()=>sentenceChoice(3,"button")}>Same (Space) </button>
    <button  on:click={()=>sentenceChoice(4,"button")}>Increase (K)</button>
    <button on:click={()=>sentenceChoice(5,"button")}>Big Increase (L)</button>
    {#if active_sentence_index > 1 && trainer === false}
      <button on:click={undoAnnotation}>Undo (U)</button>
    {/if}

{:else}
      <button on:click={()=>sentenceChoice(0,"button")}>Next (N)</button>
{/if}
</div>

{:else if workflow_state === "COMPLETE"}
<div id="sentence">
    <h2>Thank you</h2>
    <p>
    <strong>Story annotation complete.</strong>
    <p>
    {#if trainer === true}
    <p>
        <strong>Correct score: {correct_count - 1}/{active_story_sentences.length - 1}</strong>
    </p>
    {/if}
</div>
{/if}

<div id="annotation_results">

{#if show_annotations}
{#if $story_annotations.length > 0}
<table>
  <tr>
    <th>Story Id</th>
    <th>Sentence Id</th>
    <th>Sentence Num</th>
    <th>Suspense</th>
    <th>Duration Milliseconds</th>
  </tr>
{#each $story_annotations as ann}
<tr>
    <td>{ann["story_id"]}</td>
    <td>{ann["sentence_id"]}</td>
    <td>{ann["sentence_num"]}</td>
    <td>{ann["suspense"]}</td>
    <td>{ann["duration_milliseconds"]}</td>
  </tr>
  {/each}
</table>
{/if}
{/if}

</div>
