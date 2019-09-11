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
    let db_collection = "sentence_annotations_test";

    $: valid_story = true;

    let summary_question = "";
    let thought_question = "";
    let min_text_length = 25;
    let rating_question = 0;
    let assignment_id = null;
    let hit_id = null;
    let turk_submit_to = null;
    let worker_id = null;
    let min_duration = 1000;

    let annotations_lookup = new Map();
    for (const s of annotations_source.stories) {
        annotations_lookup[String(s.story_id)] = s;
    }

    import { writable } from 'svelte/store';
    export const story_annotations = writable([]);


	$: active_story_id = -1;
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

    function sentenceChoice(choice, interaction_type="button") {

        let duration = new Date().getTime() - start_timer;

        if (duration > min_duration){

            let annotation_result_map = {"story_id": active_story_id, "suspense": choice, "duration_milliseconds": duration};
            annotation_result_map["sentence_num"] = active_sentence["sentence_num"];
            annotation_result_map["sentence_id"] = active_sentence["sentence_id"];
            annotation_result_map["sentence_len"] = active_sentence["sentence_len"];
            annotation_result_map["interaction_type"] = interaction_type;

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

    }

    function undoAnnotation() {

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
                    console.log(turk_submit_to, assignment_id, docRef.id);
                    post(turk_submit_to, "/mturk/externalSubmit", {"assignmentId": assignment_id, "docRefId": docRef.id, "collection": db_collection});
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

    <h2>Instructions</h2>
    <h3>Overview</h3>
    <h4>Sentence by Sentence</h4>
    <p>The main goal of this research is to understand how people read stories and how interest and dramatic tension change over the course of the story.
    You will read a short story on a variety of themes and for each sentence be asked to assess how the drama tension increases, decreases or stays the same.
    These are all closely relate concepts. The drama or tension in a story can change moment to moment so you will be asked to rate how this changes from sentence to sentence. Each story will take an estimated
    <emph>5-7 minutes.</emph>. You are allowed to complete multiple HITS and assignments if they are not for the same story.</p>

    <p>Judge each sentence on how the dramatic tension has changed over after reading a new sentence as felt by the main characters in the story, not
    what you as a reader feel.
    This tension is the excitement or anxiousness over what will happen next. It is an expectation of what is to come though and not the same surprise which is an unexpected event happening.
     The difference: Take a dramatic moment in a story main character that needs to walk along a dangerous cliff path. When the character first realises they will need to do this the tension
     will rise. As they are on the cliff ledge then tension will increase further. Other details such as falling rocks or slips will increase the tension further to a peak. When the cliff edge
     has been navigated safely the tension will drop. The pattern will be the same with a dramatic event such as a fight , argument, accident, romantic moment, where the tension will rise to a peak
     and then fall away as the tension is resolved.

     Increasing levels of each of the following </p>
        <ul>
          <li><strong>Centrality:</strong>How central is it to the story and it's impact on the main goals, obstacles, and situation of the main characters so far.</li>
         <li><strong>Uncertainty:</strong> How uncertain are the characters involved about what will happen next. As a reader you may be sure what will happen but
         judge the change in the tension based on what the characters think. Put yourself in the characters shoes. </li>
         <li><strong>Significance:</strong>With the uncertainty over what will happen. How important is the end result. A character may choose between buying a coffee or a soda
          and the significance will be low. If the character is choosing whether to kill another character or not
          then this is much more significant. The same would be true if a description or conversation reveals a detail that suggest something of significance, for example that one of the characters
          may have been cheated on, or a description where something is out of place that hints that something important may happen.</li>
        </ul>
    <ul>
    <p>The overall judgement will be a balance of all of these. There is no need to think too long about each sentence. Read each one and choose based on your overall impression.
    Keyboard shortcuts are shown in brackets and will enable you to speed up the annotation process.
    Overall you are recording the differences as you read each sentence in expectations of what is to come. There are 5 different choices:
    </p>
      <li><strong>Big Decrease (A):</strong> A sudden dramatic decrease in dramatic tension of the situation. This may happen when there is tension in the situation and it is suddenly resolved, or something important was suggested
      in the story and it turns out to be nothing. In the cliff example the person being clear of the cliff edge. Or it could be that a violent intruder was suggested to the house but it
      turns out to be a postman just delivering a letter.</li>
      <li><strong>Decrease (S):</strong> A slow decrease in the level of tension. Not a sudden resolution but a more gradual drop. For example an argument that deescalates. </li>
      <li><strong>Same (Space):</strong> Stays at a similar level. This will happen often when there is a conversation that stays on the same level of importance or topic or continuing description.
      The expectations are similar to before.</li>
      <li><strong>Increase (K):</strong> A gradual increase in the tension. This could be something such as an conversation that is increasing in intensity, becoming more romantic or a heated argument.
      It is increasing anxiety or excitement about what is to come from the characters but not a sudden unexpected event.</li>
      <li><strong>Big Increase (L):</strong> A more sudden dramatic increase such as an argument, violence, sudden unexpected appearance of a character in dramatic circumstances, a love moment.
      An example would be someone suddenly bursting in on a scene with a gun. It is the reverse of the big decrease in being something that builds the tension quickly rather than resolving it quickly. </li>
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
    <p>These are some examples of the sentence to sentence annotations for stories. Each table is a separate story and the answer that would be expected.
    Remember that it is the relative change that is being recorded rather than the absolute tension.</p>

    <table>
    <tr><th>Judgement</th><th>Sentence Number</th><th>Text</th></tr>
    <tr><td>NA</td><td>0</td><td>Clancy Marguerian , 154 , private first class of the 150 + army , sits in his foxhole .</td></tr>
    <tr><td></td><td>1</td><td>Tired cold , wet and hungry , the only thing preventing him from laying down his rifle and walking towards the enemy lines in surrender is the knowledge that however bad he has it here , life as a 50 - 100 POW is surely much worse .</td></tr>
    <tr><td></td><td>2</td><td>He &#39;s fighting to keep his eyes open and his rifle ready when the mortar shells start landing near him .</td></tr>
    <tr><td></td><td>3</td><td>He hunkers lower .</td></tr>
    <tr><td></td><td>4</td><td>After a few minutes under the barrage , Marguerian hears hurried footsteps , a grunt , and a thud as a soldier leaps into the foxhole .</td></tr>
    <tr><td></td><td>5</td><td>The man &#39;s uniform is tan , he must be a 50 - 100 .</td></tr>
    <tr><td></td><td>6</td><td>The two men snarl and grab at eachother , grappling in the small foxhole .</td></tr>
    <tr><td></td><td>7</td><td>Abruptly , their faces come together .</td></tr>
    <tr><td></td><td>8</td><td>`` Clancy ? &#39;&#39;</td></tr>
    <tr><td></td><td>9</td><td>`` Rob ? &#39;&#39;</td></tr>
    <tr><td></td><td>10</td><td>Rob Hall , 97 , Corporal in the 50 - 100 army grins , as the situation turns from life or death struggle , to a meeting of two college friends .</td></tr>
    <tr><td></td><td>11</td><td>He lets go of Marguerian &#39;s collar .</td></tr>
    <tr><td></td><td>12</td><td>`` Holy shit Clancy , you &#39;re the last person I expected to see here &#39;&#39;</td></tr>
    <tr><td></td><td>13</td><td>`` Yeah &#39;&#39; `` Shit man , I did n&#39;t think I &#39;d ever see &#39;</td></tr>
    <tr><td></td><td>14</td><td>Mr .</td></tr>
    <tr><td></td><td>15</td><td>volunteers every saturday morning at the food shelf &#39; , not after The Reorganization at least &#39;&#39;</td></tr>
    <tr><td></td><td>16</td><td>``</td></tr>
    <tr><td></td><td>17</td><td>Yeah Rob , it is something is n&#39;t it &#39;&#39;</td></tr>
    <tr><td></td><td>18</td><td>`` Man , I &#39; m sorry</td></tr>
    <tr><td></td><td>19</td><td>I tried to kill you there ,</td></tr>
    <tr><td></td><td>20</td><td>hey , I heard you guys were out of food , here , you can share my dinner &#39;&#39; Clancy marvels , even after all this : The Reorganization , the coalitions , the war , Rob is still his old , chatty self .</td></tr>
    <tr><td></td><td>21</td><td>The two men sit , Rob chatting away , Clancy forcing out pleasantries .</td></tr>
    <tr><td></td><td>22</td><td>They pass Rob &#39;s rations between them .</td></tr>
    <tr><td></td><td>23</td><td>`` Clancy my man , I heard a group of terrorist 5 &#39;s took have formed some kind of cult , and they &#39;re rallying all the &lt; 50 in their own coalition &#39;&#39;</td></tr>
    <tr><td></td><td>24</td><td>`` Oh yeah ? &#39;&#39;</td></tr>
    <tr><td></td><td>25</td><td>`` Yeah , I mean , that sucks and everything , cause those are some scary dudes , but I heard that there &#39;s going to be a truce between our countries in a few days , why do n&#39;t we just hang out here , pretty soon we wo n&#39;t even be enemies anymore ! &#39;&#39;</td></tr>
    <tr><td></td><td>26</td><td>`` Yeah , Rob , that sounds like a plan &#39;&#39;</td></tr>
    <tr><td></td><td>27</td><td>`` Man , I &#39; m so glad I found you again , in a few days , this war will be over , and things will be cool between us and , hey , remember Sarah ?</td></tr>
    <tr><td></td><td>28</td><td>I heard she &#39;s a 151 , maybe I &#39;ll look her up , I &#39;ll be sure to visit you too once I can get a pass to sector 150 - 155 , it &#39;ll probably be tough though , even before the war</td></tr>
    <tr><td></td><td>29</td><td>, you had to do sooo much paperwork to be allowed to visit , I wonder if passes will even be reinstated after the truce ends , hey , did I ever tell you about the time ... &#39;&#39;</td></tr>
    <tr><td></td><td>30</td><td>Rob babbles as he dozes off , grinning up at Clancy .</td></tr>
    <tr><td></td><td>31</td><td>When Clancy is sure that his friend is asleep , he slits Rob &#39;s throat with his bayonet .</td></tr>
    <tr><td></td><td>32</td><td>Clancy climbs out of the foxhole , and stumbles his way back to battalion HQ .</td></tr></table>

    <table>
    <tr><th>Judgement</th><th>Sentence Number</th><th>Text</th></tr>
    <tr>NA<td></td><td>0</td><td>When the police arrived , Thomas was already waiting .</td></tr>
    <tr><td></td><td>1</td><td>His hands deep in his pockets , his face red from the cold .</td></tr>
    <tr><td></td><td>2</td><td>`` Over here , officers !</td></tr>
    <tr><td></td><td>3</td><td>`` , Thomas waved his right hand so they would notive him .</td></tr>
    <tr><td></td><td>4</td><td>After the car had stopped two policemen got out , a tall man - without the expected doughnout - belly - and a young woman .</td></tr>
    <tr><td></td><td>5</td><td>Unfortunately she was n&#39;t very attractive , but for once Thomas had something more exciting on his mind then women .</td></tr>
    <tr><td></td><td>6</td><td>They walked towards Thomas , the snow scrunched under their leather boots , and looked around .</td></tr>
    <tr><td></td><td>7</td><td>`` What &#39;s the matter , sir ?</td></tr>
    <tr><td></td><td>8</td><td>`` , the man began .</td></tr>
    <tr><td></td><td>9</td><td>`` On the phone you told us you had found the most exciting crime scene ever ?</td></tr>
    <tr><td></td><td>10</td><td>And that it must have been murder ? &#39;&#39;</td></tr>
    <tr><td></td><td>11</td><td>Thomas noticed the doubt and wariness in his voice , but he did n&#39;t let it get to him .</td></tr>
    <tr><td></td><td>12</td><td>`` That s true , why should I lie about that ?</td></tr>
    <tr><td></td><td>13</td><td>I can show you , it &#39;s right over there !</td></tr>
    <tr><td></td><td>14</td><td>`` , with these words Thomes turned around and carefully walked down the slippery way to his old wooden boat .</td></tr>
    <tr><td></td><td>15</td><td>He took a glance back and noticed , that both policemen followed him .</td></tr>
    <tr><td></td><td>16</td><td>They would be as surprised as he had been !</td></tr>
    <tr><td></td><td>17</td><td>He reached his boat and stopped , holding it with one hand and waving the officers to get in .</td></tr>
    <tr><td></td><td>18</td><td>`` Please , its in the middle of the lake !</td></tr>
    <tr><td></td><td>19</td><td>I could n&#39;t believe it at first , something like this , out here , where everybody knows everybody ... &#39;&#39;</td></tr>
    <tr><td></td><td>20</td><td>, he stopped talking as he noticed that he did n&#39;t know the police officers .</td></tr>
    <tr><td></td><td>21</td><td>`` Well , most of the people know most of the people around here ... &#39;&#39; , he continued less enthusiastic .</td></tr>
    <tr><td></td><td>22</td><td>`` But anyways &#39;&#39; , he went on , as he pushed the boat into the water .</td></tr>
    <tr><td></td><td>23</td><td>`` There are n&#39;t many murder cases around here , eh ? &#39;&#39;</td></tr>
    <tr><td></td><td>24</td><td>The woman raised an eyebrow as she noticed Thomas &#39; cheeky glimpse towards her .</td></tr>
    <tr><td></td><td>25</td><td>Noone answered his question .</td></tr>
    <tr><td></td><td>26</td><td>`` Well , it wo n&#39;t take long , I better be rowing now . &#39;&#39;</td></tr>
    <tr><td></td><td>27</td><td>Thomas did n&#39;t like the silence , he felt the officers looks in his back .</td></tr>
    <tr><td></td><td>28</td><td>Surely they were thinking he was a madman , only taking a look because it was their duty .</td></tr>
    <tr><td></td><td>29</td><td>Well , soon they would see .</td></tr>
    <tr><td></td><td>30</td><td>As they drew closer to the place , Thomas started talking again .</td></tr>
    <tr><td></td><td>31</td><td>`` You know , this lake is completely frozen during the winter .</td></tr>
    <tr><td></td><td>32</td><td>It started melting about two weeks ago , which is completely normal .</td></tr>
    <tr><td></td><td>33</td><td>I like the peace and the silence , so I bought the boat and come out here often now .</td></tr>
    <tr><td></td><td>34</td><td>Today was my first trip this year , I had a book and some beer with me</td></tr>
    <tr><td></td><td>35</td><td>- wait , there is no &#39; Do n&#39;t drink and row &#39; , is it ?</td></tr>
    <tr><td></td><td>36</td><td>`` , he asked jokingly .</td></tr>
    <tr><td></td><td>37</td><td>He turned his head to look into the serious faces of two persons who clearly were n&#39;t in the mood for jokes .</td></tr>
    <tr><td></td><td>38</td><td>`` Anyways , here I was &#39;&#39; , he pulled in the oars .</td></tr>
    <tr><td></td><td>39</td><td>`` Reading my book , as I wanted to see if there were fish in the cold water at the top . &#39;&#39;</td></tr>
    <tr><td></td><td>40</td><td>He stepped to the rail and leaned over .</td></tr>
    <tr><td></td><td>41</td><td>He deepened his voice and saw from the corner of his eye as the officers got curious and moved towards him .</td></tr>
    <tr><td></td><td>42</td><td>`` But what I saw - &#39;&#39; , he made a short pause while the officers leaned over the rail to see into the water .</td></tr>
    <tr><td></td><td>43</td><td>`` - scared me to DEATH ! &#39;&#39;</td></tr>
    <tr><td></td><td>44</td><td>With the last word he swung the meat cleaver , which sunk deep in the man &#39;s head .</td></tr>
    <tr><td></td><td>45</td><td>The body flinched and fell into the water , the woman jumped back , terror in her eyes , and tried to get her pistol from the belt .</td></tr>
    <tr><td></td><td>46</td><td>`` BECAUSE I SAW MYSELF !</td></tr>
    <tr><td></td><td>47</td><td>THOMAS , THE MAN WHO IS HATED , THE MAN WHO HATES , THE MAN WHO LOVES THE SMELL - OF - DEATH ! &#39;&#39;</td></tr>
    <tr><td></td><td>48</td><td>The woman could n&#39;t see properly anymore , tears filled her eyes .</td></tr>
    <tr><td></td><td>49</td><td>For the first time in her life she had to pull the gun , but she wans&#39;t able to .</td></tr>
    <tr><td></td><td>50</td><td>She saw the blurred madman who jumped towards her , hissing `` Death !</td></tr>
    <tr><td></td><td>51</td><td>Death !</td></tr>
    <tr><td></td><td>52</td><td>Death !</td></tr>
    <tr><td></td><td>53</td><td>`` , and felt cold steel split her chest .</td></tr>
    <tr><td></td><td>54</td><td>Over and over again he hacked her flesh .</td></tr>
    <tr><td></td><td>55</td><td>She did n&#39;t even scream .</td></tr>
    <tr><td></td><td>56</td><td>The horror had shut her mouth .</td></tr>
    <tr><td></td><td>57</td><td>As the pain faded away and she felt very tired , she sank back so that her upper body was hanging over the rail .</td></tr>
    <tr><td></td><td>58</td><td>Her last look was towards the grey sky , where the last snow began to fall .</td></tr></table>

   <table>
   <tr><th>Judgement</th><th>Sentence Number</th><th>Text</th></tr>
   <tr>NA<td></td><td>0</td><td>The city is silent today .</td></tr>
   <tr><td></td><td>1</td><td>The last screams have been muzzled , the last cries have been killed , and not a sound is echoing above the dying city of Paris .</td></tr>
   <tr><td></td><td>2</td><td>From my penthouse , I look over the once - thriving center of my country , and I weep .</td></tr>
   <tr><td></td><td>3</td><td>Smoke is rising from the Hotel des Invalides , where the remaining fighting forces took their last stance .</td></tr>
   <tr><td></td><td>4</td><td>The dome has been torn appart , and its ornament , once glistening gold , are now charred and black as coal .</td></tr>
   <tr><td></td><td>5</td><td>The top of the Eiffel Tower , the last remaining patriotic radio antenna , is missing , and its metallic beams bent in every directions look like some demented sculpture .</td></tr>
   <tr><td></td><td>6</td><td>Not a single pan of glass remains on the roof of the Great Palace , and the great Obelisk that a week ago still adorned the Place de la Concorde is invisible .</td></tr>
   <tr><td></td><td>7</td><td>I know , for seeing it yesterday , that it is now lying on the pavement , in three separate pieces .</td></tr>
   <tr><td></td><td>8</td><td>The Arc de Triomphe looks mostly intact .</td></tr>
   <tr><td></td><td>9</td><td>But I know it has lost some consequent chunks of its structure .</td></tr>
   <tr><td></td><td>10</td><td>The carvings have been heavily damaged .</td></tr>
   <tr><td></td><td>11</td><td>A quarter of the Palais du Louvre is gone , the rest of it so disfigured it is barely recognisable .</td></tr>
   <tr><td></td><td>12</td><td>I know parts of the museum &#39;s collections have been moved to safety just in time , but the rest has been hopelessly lost in the fight for the city .</td></tr>
   <tr><td></td><td>13</td><td>The tower of Montparnasse is gone as well .</td></tr>
   <tr><td></td><td>14</td><td>It fell three days into the fight , destroying most of the merchant gallery underneath , and part of the Montparnasse train station .</td></tr>
   <tr><td></td><td>15</td><td>Hundreds of people died that day .</td></tr>
   <tr><td></td><td>16</td><td>The train station was being used as an emergency shelter and field hospital at the time .</td></tr>
   <tr><td></td><td>17</td><td>Everywhere I look , I see destruction , plumes of black smoke , big holes in the city landscape I used to know so well .</td></tr>
   <tr><td></td><td>18</td><td>Buildings gutted or leveled out , rubbles blocking the streets , craters in the gardens , wrecks floating along the Seine ...</td></tr>
   <tr><td></td><td>19</td><td>The River has never been so dark with filth .</td></tr>
   <tr><td></td><td>20</td><td>Half of its bridges are gone , and those who still stand are so unstable very few will take the risk to cross them .</td></tr>
   <tr><td></td><td>21</td><td>The bridge Alexandre III has no floor anymore .</td></tr>
   <tr><td></td><td>22</td><td>Only its railing and piles .</td></tr>
   <tr><td></td><td>23</td><td>You can see the river and its macabre load leisurely passing underneath them .</td></tr>
   <tr><td></td><td>24</td><td>Sometimes , among the rubble , you can see a human form .</td></tr>
   <tr><td></td><td>25</td><td>A man , a woman , or even a child , unmoving , floating amidst the excretions of the wounded city .</td></tr>
   <tr><td></td><td>26</td><td>So many dead .</td></tr>
   <tr><td></td><td>27</td><td>So many ...</td></tr>
   <tr><td></td><td>28</td><td>I raise my eyes to the only remaining feature I can recognise .</td></tr>
   <tr><td></td><td>29</td><td>The Basilique du Sacré - Coeur is incredibly , miraculously intact .</td></tr>
   <tr><td></td><td>30</td><td>The white of its stones has lost its brightness , tainted by Paris &#39; sick exhalation , but it otherwise stands as proud , as beautiful as ever .</td></tr>
   <tr><td></td><td>31</td><td>The sanctuary has stayed unviolated throughout the whole conflict , and none of those who sought refuge there have been harmed .</td></tr>
   <tr><td></td><td>32</td><td>Not even Notre - Dame de Paris can say the same .</td></tr>
   <tr><td></td><td>33</td><td>The cathedral is missing its roof , and one of its tower fell , killing dozens of people in the process .</td></tr>
   <tr><td></td><td>34</td><td>So many .</td></tr>
   <tr><td></td><td>35</td><td>So many people , lost .</td></tr>
   <tr><td></td><td>36</td><td>And I could do nothing .</td></tr>
   <tr><td></td><td>37</td><td>I shudder as a new wave of tears makes its way through me .</td></tr>
   <tr><td></td><td>38</td><td>I cross my arms around me , trying to keep myself together , to contain it , but it is useless .</td></tr>
   <tr><td></td><td>39</td><td>My city is dying , my country is dying , my people is dying , and my heart is weeping , for them , and for me .</td></tr>
   <tr><td></td><td>40</td><td>And yet ...</td></tr>
   <tr><td></td><td>41</td><td>Foosteps behind me .</td></tr>
   <tr><td></td><td>42</td><td>I do n&#39;t turn around , I know who it is .</td></tr>
   <tr><td></td><td>43</td><td>I have been waiting for him .</td></tr>
   <tr><td></td><td>44</td><td>His arms encircle me and he presses himself against my back , laying down a kiss on my neck before putting his cheek on my head .</td></tr>
   <tr><td></td><td>45</td><td>I heave a sigh , and let the comfort of his presence calm me down .</td></tr>
   <tr><td></td><td>46</td><td>`` I hate you &#39;&#39; , I say softly , aware he can hear my tears in my strangled voice .</td></tr>
   <tr><td></td><td>47</td><td>`` I know &#39;&#39; , he replies simply .</td></tr>
   <tr><td></td><td>48</td><td>I wait in silence .</td></tr>
   <tr><td></td><td>49</td><td>Then ... `` I love you &#39;&#39; , is his whisper in my hair .</td></tr>
   <tr><td></td><td>50</td><td>I close my eyes .</td></tr>
   <tr><td></td><td>51</td><td>I have never been able to counter the effect those words said by this voice have on me .</td></tr>
   <tr><td></td><td>52</td><td>`` I know &#39;&#39; , I answer .</td></tr>
   <tr><td></td><td>53</td><td>And I do .</td></tr>
   <tr><td></td><td>54</td><td>I really do .</td></tr>
   <tr><td></td><td>55</td><td>His love for me is so intense sometimes it scares me .</td></tr>
   <tr><td></td><td>56</td><td>What he is capable of , what he is ready to do , because he loves me , what he HAS done , because he loves me , scares me .</td></tr>
   <tr><td></td><td>57</td><td>But because of that , I can never doubt it .</td></tr>
   <tr><td></td><td>58</td><td>I know he does love me , as I know the sun will rise tomorrow morning .</td></tr>
   <tr><td></td><td>59</td><td>And I know that , whatever happens , whatever he does , to me , for me , because of me , I will always be helpless to resist him .</td></tr>
   <tr><td></td><td>60</td><td>`` You are mine &#39;&#39; , he whispers .</td></tr>
   <tr><td></td><td>61</td><td>And I am .</td></tr>
   <tr><td></td><td>62</td><td>Whatever happens , whatever he does , whatever he wants , I am his , body and soul , helpless .</td></tr>
   <tr><td></td><td>63</td><td>I open my eyes .</td></tr>
   <tr><td></td><td>64</td><td>The city is laying at my feet , charred , wounded , defeated and bloodless .</td></tr>
   <tr><td></td><td>65</td><td>I look at it .</td></tr>
   <tr><td></td><td>66</td><td>Look at the ravaged ground , the grey , heavy sky , and the Sacré - Coeur , white , untouched , towering over the disaster .</td></tr>
   <tr><td></td><td>67</td><td>I look at it all , knowing I did nothing to stop it , helpless against the devastating strength of those softly whispered words , of this love that I can not live without , and I enclose it all in that part of my heart that is bleeding , that will bleed now until the day I die .</td></tr>
   <tr><td></td><td>68</td><td>Then I turn around in the haven of his arms , and I dive into his bottomless eyes , so full of so many things , so intense when they look at me , so possessive that I shudder , from fear or pleasure I do not know .</td></tr>
   <tr><td></td><td>69</td><td>Maybe both .</td></tr>
   <tr><td></td><td>70</td><td>He just tore France apart because of me , and I will carry the guilt forever .</td></tr>
   <tr><td></td><td>71</td><td>But it all fades in comparison to how he makes me feel when he says those words , when he holds me in his arms , when he takes me in his bed .</td></tr>
   <tr><td></td><td>72</td><td>Whatever he wants , I am forever helpless to deny him .</td></tr>
   <tr><td></td><td>73</td><td>`` I am yours &#39;&#39; , I say .</td></tr>
   <tr><td></td><td>74</td><td>A gleam of triumph lights his eyes , and his arms tighten around me .</td></tr>
   <tr><td></td><td>75</td><td>`` Forever . &#39;&#39;</td></tr>
   <tr><td></td><td>76</td><td>And above the silent ruins of the city he destroyed for me , he takes me , and I surrender to his overwhelming love .</td></tr>
   <tr><td></td><td>77</td><td>Whatever happens , whatever he does , forever , I am his .</td></tr>
   <tr><td></td><td>78</td><td>[ Note : English is not my first language .</td></tr>
   <tr><td></td><td>79</td><td>Anything to help me improve it , along with my writing in general , is welcome : - ) ]</td></tr></table>
 

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
    <button on:click={()=>sentenceChoice(1,"button")}>Big Decrease (A)</button>
    <button on:click={()=>sentenceChoice(2,"button")}>Decrease (S)</button>
    <button on:click={()=>sentenceChoice(3,"button")}>Same (Space) </button>
    <button  on:click={()=>sentenceChoice(4,"button")}>Increase (K)</button>
    <button on:click={()=>sentenceChoice(5,"button")}>Big Increase (L)</button>
    {#if active_sentence_index > 1}
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
