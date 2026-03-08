<script lang="ts">
  import { canCopyImage } from "./detect.js";

  type Callback = () => Promise<void> | void;

  interface Props {
    onCopyImage: Callback;
    onCopyText: Callback;
    onDownload: Callback;
    onNativeShare: Callback | undefined;
    feedback: string | null;
  }

  const {
    onCopyImage,
    onCopyText,
    onDownload,
    onNativeShare,
    feedback,
  }: Props = $props();

  let isOpen = $state(false);

  function handleMenuClick(callback: (() => Promise<void> | void) | undefined) {
    if (callback) {
      callback();
    }
    isOpen = false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Don't close if clicking the button itself
    if (target.closest("[data-share-menu-button]")) {
      return;
    }
    isOpen = false;
  }
</script>

<div class="share-menu-wrapper">
  <button
    class="btn-ghost share-btn"
    data-share-menu-button
    onclick={() => (isOpen = !isOpen)}
    disabled={feedback !== null}
  >
    {feedback ?? "Share"}
  </button>

  {#if isOpen}
    <div
      class="share-menu-dropdown"
      role="menu"
      tabindex="-1"
      onmousedown={(e) => e.preventDefault()}
    >
      {#if canCopyImage()}
        <button
          class="menu-item"
          role="menuitem"
          onclick={() => handleMenuClick(onCopyImage)}
        >
          Copy Image
        </button>
      {/if}

      <button
        class="menu-item"
        role="menuitem"
        onclick={() => handleMenuClick(onCopyText)}
      >
        Copy Text
      </button>

      <button
        class="menu-item"
        role="menuitem"
        onclick={() => handleMenuClick(onDownload)}
      >
        Download PNG
      </button>

      {#if onNativeShare}
        <button
          class="menu-item"
          role="menuitem"
          onclick={() => handleMenuClick(onNativeShare)}
        >
          Share...
        </button>
      {/if}
    </div>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={handleClickOutside}></div>
  {/if}
</div>

<svelte:window onclick={handleClickOutside} />

<style>
  .share-menu-wrapper {
    position: relative;
    display: inline-block;
    margin-left: auto;
  }

  .share-btn {
    font-size: 0.8rem;
  }

  .share-menu-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    background: #14142a;
    border: 1px solid rgba(106, 100, 136, 0.3);
    border-radius: 0.375rem;
    overflow: hidden;
    min-width: 140px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 0.65rem 1rem;
    background: transparent;
    border: none;
    color: #eae0ca;
    text-align: left;
    font-size: 0.85rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }

  .menu-item:hover {
    background: #1c1c35;
  }

  .menu-item:not(:last-child) {
    border-bottom: 1px solid rgba(106, 100, 136, 0.15);
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999;
  }
</style>
