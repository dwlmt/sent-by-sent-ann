<script>

    import { writable } from 'svelte/store';
    export const story_annotations = writable([]);

	$: active_story_id = 1;
	$: last_choice = 0;
	$: active_story_complete = false;
	$: story_started = false;
	$: workflow_state = "INSTRUCTIONS";

	$: start_timer = new Date().getTime();

	export let active_story = [
    	 {
          "sentence_id": 0,
          "sentence_num": 1,
          "sentence_text": "It was dark and Levi was pretty sure he was lying on his back ."
        },
         {
              "sentence_id": 1,
              "sentence_num": 2,
              "sentence_text": "There was firelight flickering off of what was left of a ceiling ."
            },
          {
               "sentence_id": 2,
               "sentence_num": 3,
               "sentence_text": "He could hear something but it was muffled ."
             },

          {
               "sentence_id": 3,
               "sentence_num": 4,
               "sentence_text": "He was almost positive it was screaming ."
             },

           {
                "sentence_id": 4,
                "sentence_num": 5,
                "sentence_text": "When he tried to move he felt an excruciating pain in his left side that caused him to cry out ."
              },

            {
                 "sentence_id": 5,
                 "sentence_num": 6,
                 "sentence_text": "His hand moved to it instinctively and found something protruding from the wound ."
               },

            {
                 "sentence_id": 6,
                 "sentence_num": 7,
                 "sentence_text": "It seemed to be a pipe of some kind ."
               },

          {
               "sentence_id": 7,
               "sentence_num": 8,
               "sentence_text": "Levi &#39;s ears began ringing and the sounds began to become clearer , it felt quite a bit like some one was driving needles into his eardrums ."
             },

              {
                   "sentence_id": 8,
                   "sentence_num": 9,
                   "sentence_text": "The sounds he was hearing were definitely screams and not just one person &#39;s , a lot of people were screaming or yelling ."
                 },

              {
                   "sentence_id": 9,
                   "sentence_num": 10,
                   "sentence_text": "There was some one close to him that was crying ."
                 },
        ];
        $: active_sentence_index = 0;
        $: active_sentence = active_story[active_sentence_index];

    function sentenceChoice(choice) {

        let duration = new Date().getTime() - start_timer;

        let annotation_result_map = {"story_id": active_story_id, "suspense": choice, "duration_milliseconds": duration};
        annotation_result_map["sentence_num"] = active_sentence["sentence_num"];
        annotation_result_map["sentence_id"] = active_sentence["sentence_id"];
        annotation_result_map["sentence_text"] = active_sentence["sentence_text"];

         if (active_story_complete === false) {
            story_annotations.update(n => n.concat([annotation_result_map]));
         }

        if (active_sentence_index + 1 === active_story.length) {
            active_story_complete = true;
            workflow_state = "COMPLETE"
        }

        active_sentence_index = Math.min(active_sentence_index + 1, active_story.length - 1);
        last_choice = choice;

        start_timer = new Date().getTime();

    }

    function sentenceBigDecrease() {
            sentenceChoice(1)
        }
    function sentenceDecrease() {
            sentenceChoice(2)
        }
    function sentenceSame() {
        sentenceChoice(3)
    }
    function sentenceIncrease() {
        sentenceChoice(4)
    }
    function sentenceBigIncrease() {
         sentenceChoice(5)
    }

    function startStoryAnnotation() {
        workflow_state = "ANNOTATE";
        start_timer = new Date().getTime();
    }


</script>

<style>

</style>
<header>
<h1>Story: {active_story_id} </h1>
</header>

{#if workflow_state === "INSTRUCTIONS"}
<div id="sentence">
    <h2>Instructions</h2>
    <p>
    <strong>These are some instructions.</strong>
    <p>
     <button on:click={startStoryAnnotation}>Start</button>
</p>
</div>
{/if}

{#if workflow_state === "ANNOTATE"}
<div id="sentence">
    <h3>{active_sentence["sentence_num"]} - {active_sentence["sentence_text"]}</h3>
    <p>
    <strong>{active_sentence_index + 1}/{active_story.length}</strong>
</p>
</div>
<div id="sentence_buttons">

{#if active_sentence_index > 0}
    <button on:click={sentenceBigDecrease}>Big Decrease</button>
    <button on:click={sentenceDecrease}>Decrease</button>
    <button on:click={sentenceSame}>Same</button>
    <button  on:click={sentenceIncrease}>Increase</button>
    <button on:click={sentenceBigIncrease}>Big Increase</button>
{:else}
      <button on:click={sentenceSame}>Next</button>
{/if}
</div>
{/if}

{#if workflow_state === "COMPLETE"}
<div id="sentence">
    <h2>Thank you</h2>
    <p>
    <strong>Story annotation complete. Link into MTurk with code, or link for new story to annotate.</strong>
    <p>
</p>
</div>
{/if}

<div id="annotation_results">

{#if $story_annotations.length > 0}
<table>
  <tr>
    <th>Story Id</th>
    <th>Sentence Id</th>
    <th>Sentence Num</th>
    <th>Suspense</th>
    <th>Duration Milliseconds</th>
    <th>Sentence Text</th>
  </tr>
{#each $story_annotations as ann}
<tr>
    <td>{ann["story_id"]}</td>
    <td>{ann["sentence_id"]}</td>
    <td>{ann["sentence_num"]}</td>
    <td>{ann["suspense"]}</td>
    <td>{ann["duration_milliseconds"]}</td>
    <td>{ann["sentence_text"]}</td>
  </tr>
  {/each}
</table>
{/if}

</div>
