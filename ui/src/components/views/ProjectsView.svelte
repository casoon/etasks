<!-- @module:projects -->
<script lang="ts">
  import { $selectedProject as selectedProjectStore } from '../../stores/projectStore';
  import ProjectList from './ProjectList.svelte';
  import ProjectDetail from './ProjectDetail.svelte';

  $: project = $selectedProjectStore;
</script>

<div class="flex-1 flex flex-col overflow-hidden h-full">
  {#if project}
    {#key project.id}
      <ProjectDetail {project} />
    {/key}
  {:else}
    <ProjectList />
  {/if}
</div>
