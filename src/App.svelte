<script>
    import annotations_source from '../static/annotations_source.json';

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

    $: valid_story = true;

    let summary_question = "";
    let thought_question = "";
    let min_text_length = 25;
    let rating_question = 0;
    let assignment_id = null;
    let hit_id = null;
    let turk_submit_to = null;
    let worker_id = null;

    let annotations_lookup = new Map();
    for (const s of annotations_source.stories) {
        annotations_lookup[String(s.story_id)] = s;
    }

    import { writable } from 'svelte/store';
    export const story_annotations = writable([]);

	$: active_story_id = -1
	$: code = -1;
	$: last_choice = 0;
	$: active_story_complete = false;
	$: workflow_state = "INSTRUCTIONS";
	$: show_annotations = false;

	$: start_timer = new Date().getTime();
	$: whole_task_timer = new Date().getTime();

	$: active_story_sentences = [];
    $: active_sentence_index = 0;
    $: active_sentence = null;

    function sentenceChoice(choice) {

        let duration = new Date().getTime() - start_timer;

        let annotation_result_map = {"story_id": active_story_id, "suspense": choice, "duration_milliseconds": duration};
        annotation_result_map["sentence_num"] = active_sentence["sentence_num"];
        annotation_result_map["sentence_id"] = active_sentence["sentence_id"];
        annotation_result_map["sentence_len"] = active_sentence["sentence_len"];

         if (active_story_complete === false) {
            console.log(`Annotations: ${annotation_result_map}`);
            story_annotations.update(n => n.concat([annotation_result_map]));
         }

        if (active_sentence_index + 1 === active_story_sentences.length) {
            active_story_complete = true;
            workflow_state = "SUMMARY"
        }

        active_sentence_index = Math.min(active_sentence_index + 1, active_story_sentences.length - 1);
        active_sentence = active_story_sentences[active_sentence_index]
        last_choice = choice;

        start_timer = new Date().getTime();

    }

    function sentenceFirst() {
        sentenceChoice(0);
    }
    function sentenceBigDecrease() {
            sentenceChoice(1);

        }
    function sentenceDecrease() {
            sentenceChoice(2);

        }
    function sentenceSame() {
        sentenceChoice(3);

    }
    function sentenceIncrease() {
        sentenceChoice(4);

    }
    function sentenceBigIncrease() {
         sentenceChoice(5);

    }

    function undoAnnotation() {
         if (active_story_complete === false) {
                    story_annotations.update(n => {
                        active_sentence_index -= 1
                        active_sentence = active_story_sentences[active_sentence_index];
                        return n.slice(0, -1);
                    })
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
        console.log("Query params", query_params)

        let mturk_code = query_params.get("mturkCode");

        let active_story_id = query_params.get("story_id");
        let code = query_params.get("code");

        if (mturk_code != null && mturk_code.length > 0)     {
            [active_story_id, code] =  mturk_code.split("-");
        }

        if (String(active_story_id) in annotations_lookup){
            let story = annotations_lookup[active_story_id];
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

            db.collection("sentence_annotations_test").add(comp_annotations)
            .then(function(docRef) {
                console.log("Document written with ID: ", docRef.id);

                if (turk_submit_to != null && turk_submit_to.length > 0) {
                    console.log(turk_submit_to, assignment_id, docRef.id);
                    post(turk_submit_to, "/mturk/externalSubmit", {"assignmentId": assignment_id, "docRefId": docRef.id});
                } else {
                    workflow_state = "COMPLETE";
                }
            })
            .catch(function(error) {
                console.error("Error adding document: ", error);
            });
        }
     }

    function handleKeydown(event) {
        if (workflow_state === "ANNOTATE") {
            if  (event.key === "a" || event.key === "A" ) {
                sentenceBigDecrease()
            }
            else if  (event.key === "s" || event.key === "S") {
                sentenceDecrease()
            }
            else if  (event.key === "k" || event.key === "K") {
                sentenceIncrease()
            }
            else if  (event.key === "l" || event.key === "L") {
                sentenceBigIncrease()
            }
            else if  (event.key === "u" || event.key === "U") {
                if (active_sentence_index > 1) {
                    undoAnnotation()
                }
            }
            else if  (event.key === "n" || event.key === "N") {
                            sentenceFirst()
                        }
            else if  (event.key === " ") {
                  sentenceSame()
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

<svelte:window on:keydown={handleKeydown}/>

{#if workflow_state === "INVALID_STORY"}
<div id="sentence">
    <h2>Invalid Story</h2>
    <p>
    <strong>The story is not recognised. </strong>

</div>

{:else if workflow_state === "INSTRUCTIONS"}
<div id="sentence">

      <button on:click={startStoryAnnotation}>Start</button>

    <h2>Instructions</h2>
    <h3>Overview</h3>
    <h4>Sentence by Sentence</h4>
    <p>The main goal of this research is to understand how people read stories and how interest and dramatic tension change over the course of the story.
    You will read a short story on a variety of themes and for each sentence be asked to assess how the drama, interest, suspense or tension increase, decrease or stays the same.
    These are all closely relate concepts. The drama or tension in a story can change moment to moment so you will be asked to rate how this changes from sentence to sentence. Each story will take an estimated
    <emph>x-y minutes.</emph>. You are allowed to complete multiple HITS and assignments if they are not for the same story.</p>

    <p>Judge each increase or decrease on:</p>
        <ul>
          <li><strong>Curiousity:</strong> How curious are you about what happens next. Or you know what is likely to happen but are interested to know how.</li>
          <li><strong>Emotion</strong> A state or feeling of excited or anxious uncertainty about what may happen in the story or concern over a character.</li>
          <li><strong>Uncertainty:</strong> How uncertain you are over what will happen. </li>
          <li><strong>Interest:</strong> Is this the change more or less central to the plot. Does it affect a goal of a major character, threaten them in some way, or exciting for them.</li>
          <li><strong>Intensity:</strong> How much intensity is there in the events or situation described. The general change in tension.</li>
        </ul>
    <ul>
    <p>The overall judgement will be a balance of all of these. There is no need to think too long about each sentence. Read each one and choose based on your overall impression.
    Keyboard shortcuts are shown in brackets and will enable you to speed up the annotation process. Overall you are recording the differences as you read each sentence in expectations and not the absolute level.
    </p>
      <li><strong>Big Decrease (A):</strong> A sudden dramatic decrease in the situation. This may happen when there is tension in the situation and it is suddenly resolved, or something important was suggested
      in the story and it turns out to be nothing.</li>
      <li><strong>Decrease (S):</strong> A slow decrease in the level of tension. Not a sudden resolution but a more gradual drop.</li>
      <li><strong>Same (Space):</strong> Stays at a similar level. This will happen often when there is a conversation that stays on the same level of importance or topic or continuing description.</li>
      <li><strong>Increase (K):</strong> A gradual increase in the tension. This could be something such as an conversation that is increasing in intensity, becoming more romantic or a heated argument.
      Some opportunity or threat
      Something </li>
      <li><strong>Big Increase (L):</strong> A more sudden dramatic increase such as an argument, violence, sudden unexpected appearance of a character in dramatic circumstances, a love moment.
      The main thing is that the change is more sudden from the previous sentence.</li>
       </ul>
    <h4>Review Questions</h4>
    <p>At the end are a review questions to assess the story overall:</p>
    <ul>
      <li><strong>Summary: </strong> Write a short one or two sentence summary of what the story is about. This should mention the main character(s),
      plot points, goals or obstacles that the characters overcame in the story.</li>
      <li><strong>Review:</strong> Write a couple of sentences reviewing the story saying what you like or don't like about it and why. For either mention if it is the topic, characters, action,
       tension etc that draw you into the story or find boring.</li>
      <li><strong>Rating:</strong> A 5 point scale from very uninteresting to very interesting. Just go with your own judgement.</li>
    </ul>
    <h3>Examples</h3>
    <p>These are some examples of the sentence to sentence annotation categories and expected response.
    These judgements are subjective and so are guidence. They only show the previous sentence but really it is the story
    up to that point that you are judging the story from.</p>

    <table>
      <tr>
        <th><span style="font-weight:bold">Category</span></th>
        <th><span style="font-weight:bold">Context</span></th>
        <th><span style="font-weight:bold">Transition</span></th>
        <th><span style="font-weight:bold">Reason</span></th>
      </tr>
      <tr>
        <td><strong>Big Decrease (A):</strong></td>
        <td>Holy shit , Mulder , is that a giant tentacle ?</td>
        <td>I'm pretty sure that the Loch Ness monster doesn't have tentacles.</td>
        <td>Refrain takes the drama out of the situation with skeptical note. Follows highly animated conversation.</td>
      </tr>
      <tr>
              <td><strong>Big Decrease (A):</strong></td>
              <td>As the pain faded away and she felt very tired , she sank back so that her upper body was hanging over the rail .</td>
              <td>Her last look was towards the grey sky , where the last snow began to fall .</td>
              <td>Follows and closes of a violent murder scene and so hugley reduces the tension.</td>
            </tr>
       <tr>
              <td><strong>Decrease (S):</strong></td>
              <td>No more mercenary bullshit for me .</td>
              <td>Just teaching.</td>
              <td>Stepping down the tension.</td>
            </tr>
      <tr>
        <td><strong>Decrease (S):</strong></td>
        <td>I assume they just thought it was funny .</td>
        <td>I guess this happens , when you let the internet decide on things .</td>
        <td>Not a big change but closes off the topic.</td>
      </tr>

       <tr>
            <td><strong>Same (Space):</strong></td>
            <td>
               The two men sit , Rob chatting away , Clancy forcing out pleasantries .
            </td>
            <td>
              They pass Rob 's rations between them .
            </td>
            <td>
                A continuation of an action but doesn't change the intensity.
            </td>
    </tr>
     <tr>
                <td><strong>Same (Space):</strong></td>
                <td>
                   It was the bartender , of course .
                </td>
                <td>
                  A short , stubby little man with a shaved head but by no means a shaved face .
                </td>
                <td>
                    Carrying onto a natural description of the Bartender but not changing the Drama of the Story.
                </td>
        </tr>
     <tr>
    <td><strong>Increase (K):</strong></td>
   <td>
       Clancy Marguerian , 154 , private first class of the 150 + army , sits in his foxhole .
       </td>
       <td>
           Tired cold , wet and hungry , the only thing preventing him from laying down his rifle and walking towards the enemy lines in surrender is the knowledge that however bad he has it here , life as a 50 - 100 POW is surely much worse .
       </td>
       <td>
           Mentioning the POW Camp and surrending increase the tension but it is an incremental and not a sudden change.
       </td>
  </tr>

   <tr>
      <td><strong>Increase (K):</strong></td>
     <td>
         A painting of modest beauty but exquisite detail .
         </td>
         <td>
             Inside , however , lies a drawing soaked in black ink and torn to shreds .
         </td>
         <td>
             Descriptive, but the emotive language raises the tension and asks questions about what the drawing may be.
         </td>
    </tr>
   <tr>
      <td><strong>Big Increase (L):</strong></td>
      <td>
            The man 's uniform is tan , he must be a 50 - 100 .
      </td>
      <td>
          The two men snarl and grab at each other , grappling in the small foxhole .
      </td>
      <td>
          There is a sudden escalation from describing a man appearing to a fight.
      </td>
    </tr>
    <tr>
          <td><strong>Big Increase (L):</strong></td>
          <td>
                When the bunny finally tired out and became complacent , Susie Cutie slowly reached up , with a lifetime of anticipation bursting in her heart , and patted her hand between the bunny 's ears .
          </td>
          <td>
              Smiling , Susan twisted the rabbit 's head sharply , killing it , then flipped it over to examine that cute , cute bunny tail up close .
          </td>
          <td>
              The build talks about love for Rabbits and so this sentence is a big break from what is expected.
          </td>
        </tr>
    </table>

</div>
{:else if workflow_state === "SUMMARY"}
<div id="sentence">
    <h2>Summary</h2>
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
    <p>
    <strong>{active_sentence_index + 1}/{active_story_sentences.length}</strong>
</p>
</div>
<div id="sentence_buttons">

{#if active_sentence_index > 0}
    <button on:click={sentenceBigDecrease}>Big Decrease (A)</button>
    <button on:click={sentenceDecrease}>Decrease (S)</button>
    <button on:click={sentenceSame}>Same (Space) </button>
    <button  on:click={sentenceIncrease}>Increase (K)</button>
    <button on:click={sentenceBigIncrease}>Big Increase (L)</button>
    {#if active_sentence_index > 1}
      <button on:click={undoAnnotation}>Undo (U)</button>
    {/if}

{:else}
      <button on:click={sentenceFirst}>Next (N)</button>
{/if}
</div>

{:else if workflow_state === "COMPLETE"}
<div id="sentence">
    <h2>Thank you</h2>
    <p>
    <strong>Story annotation complete.</strong>
    <p>
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
