<script lang="ts">
  import { onNavigate } from "$app/navigation";
  import "../app.css";

  let { children } = $props();

  // View Transitions API — progressive enhancement.
  // Only Chromium supports this as of 2026; other browsers get instant transitions.
  onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

{@render children()}
