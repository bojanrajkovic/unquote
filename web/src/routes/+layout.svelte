<script lang="ts">
  import { onNavigate } from "$app/navigation";
  import "../app.css";

  let { children } = $props();

  // View Transitions API — progressive enhancement (Baseline Oct 2025).
  // Falls back to instant transitions in older browsers.
  onNavigate((navigation) => {
    if (!document.startViewTransition) {
      return;
    }

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

{@render children()}
