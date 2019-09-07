<script>

    import annotations_source from '../static/annotations_source.json';

    $: valid_story = true;

    let summaryQuestion = "";
    let thoughtQuestion = "";

    let annotations_lookup = new Map();
    for (const s of annotations_source.stories) {
        console.log(s)
        annotations_lookup[String(s.story_id)] = s;
    }

    import { writable } from 'svelte/store';
    export const story_annotations = writable([]);

	$: active_story_id = -1//query_params["story_id"];
	$: code = -1//; query_params["code"];
	$: last_choice = 0;
	$: active_story_complete = false;
	$: workflow_state = "INSTRUCTIONS";
	$: show_annotations = true;

	$: start_timer = new Date().getTime();

	$: active_story_sentences = [];
    $: active_sentence_index = 0;
    $: active_sentence = null;

    function sentenceChoice(choice) {

        let duration = new Date().getTime() - start_timer;

        let annotation_result_map = {"story_id": active_story_id, "suspense": choice, "duration_milliseconds": duration};
        annotation_result_map["sentence_num"] = active_sentence["sentence_num"];
        annotation_result_map["sentence_id"] = active_sentence["sentence_id"];
        annotation_result_map["text"] = active_sentence["text"];

         if (active_story_complete === false) {
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
        sentenceChoice(0)
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

    function undoAnnotation() {
         if (active_story_complete === false) {
                    story_annotations.update(n => {
                        active_sentence_index -= 1
                        return n.slice(0, -1);
                    })
                 }
    }

    function startStoryAnnotation() {
        let query_params = new URLSearchParams(window.location.search);

        active_story_id = query_params.get("story_id");

        if (String(active_story_id) in annotations_lookup){
            let story = annotations_lookup[active_story_id];
            active_story_sentences = story["sentences"];
            active_sentence = active_story_sentences[active_sentence_index];

            let code = query_params.get("code");

            if (code === story.code) {
                workflow_state = "ANNOTATE";
            } else {
                workflow_state = "INVALID_STORY";
            }

            start_timer = new Date().getTime();
        }
    }

    function submitStoryAnnotation() {

        workflow_state = "COMPLETE";
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

<svelte:window on:keydown={handleKeydown}/>

{#if workflow_state === "INVALID_STORY"}
<div id="sentence">
    <h2>Invalid Story</h2>
    <p>
    <strong>The story is not recognised. </strong>

</div>

{:else if workflow_state === "INSTRUCTIONS"}
<div id="sentence">
    <h2>Instructions</h2>
    <p>
    <strong>These are some instructions.</strong>
    <p>
     <button on:click={startStoryAnnotation}>Start</button>
</p>
</div>
{:else if workflow_state === "SUMMARY"}
<div id="sentence">
    <h2>Summary</h2>
    <p>
    <h3>Please write a summary of the story in one or two sentences.</h3>
    <form onsubmit="event.preventDefault(); return submitForm();">
    <p>
     <textarea rows = "3" cols = "100" name = "summary" id="summary" bind:value={summaryQuestion}></textarea>
    <p>
        <h3>Do you think the story is interesting or not? And why? One or two sentences.</h3>

    <p>
      <textarea rows = "3" cols = "100" name = "thoughts" id="thoughts" bind:value={thoughtQuestion}></textarea>
    <p>
     <button on:click={submitStoryAnnotation}>Submit</button>
     </form>
</div>
{:else if workflow_state === "ANNOTATE"}

<h1>Story: {active_story_id} </h1>

<div id="sentence">
    <h3>{active_sentence["sentence_num"]} - {active_sentence["text"]}</h3>
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
    <strong>Story annotation complete. Link into MTurk with code, or link for new story to annotate.</strong>
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
    <th>Sentence Text</th>
  </tr>
{#each $story_annotations as ann}
<tr>
    <td>{ann["story_id"]}</td>
    <td>{ann["sentence_id"]}</td>
    <td>{ann["sentence_num"]}</td>
    <td>{ann["suspense"]}</td>
    <td>{ann["duration_milliseconds"]}</td>
    <td>{ann["text"]}</td>
  </tr>
  {/each}
</table>
{/if}
{/if}

</div>
