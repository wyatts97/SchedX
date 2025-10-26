<script lang="ts">
    import { browser } from '$app/environment';
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import ImageEditor from 'tui-image-editor';
    import 'tui-image-editor/dist/tui-image-editor.css';
    import 'tui-color-picker/dist/tui-color-picker.css';

    export let open = false;
    export let imageUrl = '';
    export let filename = '';
    export let onSave: ((editedImageBlob: Blob, filename: string) => Promise<void>) | null = null;

    let saving = false;
    let currentTheme: 'light' | 'dark' | 'lightsout' = 'light';
    let editorContainer: HTMLDivElement | null = null;
    let editor: any = null;

    function detectTheme(): 'light' | 'dark' | 'lightsout' {
        if (!browser) return 'light';
        const html = document.documentElement;
        const theme = html.getAttribute('data-theme');
        if (theme === 'dark') return 'dark';
        if (theme === 'lightsout') return 'lightsout';
        return 'light';
    }

    $: if (open && browser) {
        currentTheme = detectTheme();
    }

    function closeEditor() {
        open = false;
        saving = false;
        destroyEditor();
    }

    function destroyEditor() {
        if (editor && typeof editor.destroy === 'function') {
            editor.destroy();
        }
        editor = null;
    }

    function initEditor() {
        if (!browser || !editorContainer || !open) return;
        destroyEditor();

        const uiTheme = currentTheme === 'light' ? {} : {};

        editor = new ImageEditor(editorContainer, {
            includeUI: {
                loadImage: {
                    path: imageUrl || '',
                    name: filename || 'image'
                },
                theme: uiTheme,
                menu: ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'filter'],
                initMenu: '',
                uiSize: {
                    width: '100%',
                    height: '100%'
                },
                menuBarPosition: 'bottom'
            },
            cssMaxWidth: 2000,
            cssMaxHeight: 2000,
            selectionStyle: {
                cornerSize: 20,
                rotatingPointOffset: 70
            }
        });
    }

    onMount(() => {
        if (open) initEditor();
    });

    afterUpdate(() => {
        if (open && editor == null && editorContainer) {
            initEditor();
        }
        // If the image changes while open, reload it
        if (open && editor && imageUrl) {
            // loadImageFromURL returns a promise
            editor.loadImageFromURL(imageUrl, filename || 'image').catch(() => {});
        }
    });

    onDestroy(() => {
        destroyEditor();
    });

    function dataURLToBlob(dataURL: string): Blob {
        const parts = dataURL.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    async function handleSave() {
        try {
            if (!editor) return;
            saving = true;
            // Choose output format based on original filename
            const ext = (filename.split('.').pop() || '').toLowerCase();
            let format: 'png' | 'jpeg' = 'png';
            if (ext === 'jpg' || ext === 'jpeg') format = 'jpeg';
            const dataURL: string = editor.toDataURL({ format, quality: 0.92 });
            const blob = dataURLToBlob(dataURL);
            if (onSave) {
                await onSave(blob, filename);
            }
            setTimeout(() => closeEditor(), 100);
        } catch (error) {
            console.error('Error saving edited image:', error);
            alert('Failed to save edited image. Please try again.');
        } finally {
            saving = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && !saving) {
            closeEditor();
        }
    }
</script>

{#if open}
    <div
        class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        on:click={closeEditor}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && closeEditor()}
    >
        <div
            class="relative h-[90vh] w-[90vw] overflow-hidden rounded-lg shadow-2xl"
            class:bg-white={currentTheme === 'light'}
            class:bg-gray-900={currentTheme === 'dark'}
            class:bg-black={currentTheme === 'lightsout'}
            on:click|stopPropagation
            role="dialog"
            tabindex="-1"
            on:keydown={handleKeydown}
        >
            <div class="h-full w-full">
                <div bind:this={editorContainer} class="h-full w-full"></div>
            </div>

            <div class="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-3">
                <button
                    class="pointer-events-auto rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-50"
                    on:click|stopPropagation={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {#if saving}
                <div class="absolute inset-0 z-[100001] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div
                        class="rounded-lg p-6 shadow-xl"
                        class:bg-white={currentTheme === 'light'}
                        class:bg-gray-800={currentTheme === 'dark'}
                        class:bg-black={currentTheme === 'lightsout'}
                        class:border={currentTheme === 'lightsout'}
                        class:border-gray-700={currentTheme === 'lightsout'}
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
                                class:border-blue-600={currentTheme === 'light' || currentTheme === 'dark'}
                                class:border-blue-400={currentTheme === 'lightsout'}
                            ></div>
                            <span
                                class="text-lg font-medium"
                                class:text-gray-900={currentTheme === 'light'}
                                class:text-white={currentTheme === 'dark' || currentTheme === 'lightsout'}
                            >Saving image...</span>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    :global(.tui-image-editor) {
        height: 100%;
        width: 100%;
    }
</style>
