<script lang="ts">
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>Unquote — {page.status}</title>
</svelte:head>

<main class="error-screen">
  <header class="compact-header">
    <a href="/" class="compact-logo">Unquote</a>
  </header>
  <div class="error-body">
    <p class="error-code">{page.status}</p>
    <p class="error-heading">
      {#if page.status === 404}
        Page not found
      {:else}
        Something went wrong
      {/if}
    </p>
    <p class="error-detail">
      {#if page.status === 404}
        The page you're looking for doesn't exist.
      {:else if page.error?.message}
        {page.error.message}
      {:else}
        An unexpected error occurred.
      {/if}
    </p>
    <a href="/game" class="btn-primary">Back to puzzle →</a>
  </div>
</main>

<style>
  .error-screen {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  .error-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.25rem;
    text-align: center;
    gap: 0.5rem;
  }

  .error-code {
    font-family: var(--font-mono);
    font-size: 3.5rem;
    font-weight: 700;
    color: var(--color-gold-dim);
    line-height: 1;
    letter-spacing: 0.08em;
    margin: 0;
  }

  .error-heading {
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--color-text-primary);
    margin: 0.5rem 0 0;
  }

  .error-detail {
    font-size: 0.82rem;
    color: var(--color-text-secondary);
    max-width: 300px;
    line-height: 1.5;
    margin: 0;
  }

  .btn-primary {
    margin-top: 1.5rem;
    text-decoration: none;
  }
</style>
