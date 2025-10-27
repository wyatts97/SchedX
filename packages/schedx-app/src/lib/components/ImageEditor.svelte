<script lang="ts">
    import { browser } from '$app/environment';
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    // Load CSS at runtime on client to avoid SSR resolution issues
    import iconAUrl from 'tui-image-editor/dist/svg/icon-a.svg?url';
    import iconBUrl from 'tui-image-editor/dist/svg/icon-b.svg?url';
    import iconCUrl from 'tui-image-editor/dist/svg/icon-c.svg?url';
    import iconDUrl from 'tui-image-editor/dist/svg/icon-d.svg?url';

    export let open = false;
    export let imageUrl = '';
    export let filename = '';
    export let onSave: ((editedImageBlob: Blob, filename: string) => Promise<void>) | null = null;

    let saving = false;
    let currentTheme: 'light' | 'dark' | 'lightsout' = 'light';
    let editorContainer: HTMLDivElement | null = null;
    let editor: any = null;
    let fittedOnceForSrc = '';
    let resizeObserver: ResizeObserver | null = null;
    let lastImageSize: { oldWidth: number; oldHeight: number; newWidth: number; newHeight: number } | null = null;
    let isInteractingWithCanvas = false;

    function measureContainer() {
        if (!editorContainer) return { w: 0, h: 0 };
        const rect = editorContainer.getBoundingClientRect();
        return { w: Math.max(1, Math.floor(rect.width)), h: Math.max(1, Math.floor(rect.height)) };
    }

    function updateUiSize() {
        if (!editor) return;
        const { w, h } = measureContainer();
        if (!w || !h) return;
        try {
            const resizeOptions: any = { uiSize: { width: `${w}px`, height: `${h}px` } };
            // Include imageSize if available to properly handle dynamic image loading
            if (lastImageSize) {
                resizeOptions.imageSize = lastImageSize;
            }
            editor.ui?.resizeEditor(resizeOptions);
        } catch {}
    }

    async function waitForEditorUnlock() {
        if (!editor) return;
        // Wait for the editor to be unlocked before performing operations
        return new Promise<void>((resolve) => {
            const checkLock = () => {
                if (!editor._invoker?._isLocked) {
                    resolve();
                } else {
                    setTimeout(checkLock, 50);
                }
            };
            checkLock();
        });
    }

    async function fitCanvasOnce() {
        if (!editor) return;
        await waitForEditorUnlock();
        
        // Prefer measuring the inner main canvas area for accurate fit
        const main = editorContainer?.querySelector('.tui-image-editor-main') as HTMLElement | null;
        const rect = main?.getBoundingClientRect();
        const availW = rect ? Math.floor(rect.width) : measureContainer().w;
        const availH = rect ? Math.floor(rect.height) : measureContainer().h;
        if (!availW || !availH) return;
        
        const size = editor.getCanvasSize?.();
        const imgW = size?.width || 0;
        const imgH = size?.height || 0;
        if (!imgW || !imgH) return;
        
        // Calculate scale to fit image within available space while maintaining aspect ratio
        const scale = Math.min(availW / imgW, availH / imgH, 1);
        const newW = Math.max(1, Math.floor(imgW * scale));
        const newH = Math.max(1, Math.floor(imgH * scale));
        
        try {
            await editor.resizeCanvasDimension({ width: newW, height: newH });
            // Update UI with proper imageSize parameters
            if (lastImageSize) {
                try { 
                    editor.ui?.resizeEditor({ 
                        imageSize: lastImageSize 
                    }); 
                } catch {}
            }
        } catch {}
    }

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
        // Disable page scroll while modal open and block interactions outside modal
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.documentElement.classList.add('image-editor-open');
    }

    function closeEditor() {
        open = false;
        saving = false;
        fittedOnceForSrc = ''; // Reset to allow proper fitting on next open
        lastImageSize = null; // Reset image size state
        isInteractingWithCanvas = false;
        destroyEditor();
        if (browser) {
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.documentElement.classList.remove('image-editor-open');
        }
    }

    function destroyEditor() {
        if (editor && typeof editor.destroy === 'function') {
            editor.destroy();
        }
        editor = null;
    }

    async function initEditor() {
        if (!browser || !editorContainer || !open) return;
        destroyEditor();

        // Ensure styles are present (client-only)
        await import('tui-image-editor/dist/tui-image-editor.css');
        await import('tui-color-picker/dist/tui-color-picker.css');

        // Use local-bundled asset URLs for icons to avoid CORS
        const uiTheme = {
            'menu.normalIcon.path': iconDUrl,
            'menu.activeIcon.path': iconCUrl,
            'menu.disabledIcon.path': iconAUrl,
            'menu.hoverIcon.path': iconBUrl,
            'submenu.normalIcon.path': iconDUrl,
            'submenu.activeIcon.path': iconCUrl
        };

        const { default: TuiImageEditor } = await import('tui-image-editor');

        const { w, h } = measureContainer();

        editor = new TuiImageEditor(editorContainer, {
            includeUI: {
                loadImage: {
                    path: imageUrl || '',
                    name: filename || 'image'
                },
                theme: uiTheme,
                menu: ['crop', 'flip', 'rotate', 'draw', 'shape', 'icon', 'text', 'filter'],
                initMenu: '',
                uiSize: { width: `${w}px`, height: `${h}px` },
                menuBarPosition: 'left'
            },
            // Don't set cssMaxWidth/cssMaxHeight - they limit the canvas incorrectly
            selectionStyle: {
                cornerSize: 20,
                rotatingPointOffset: 70
            },
            // Disable GA pings
            usageStatistics: false
        });

        // Listen for the initial image load event
        editor.on('addText', () => {
            // This ensures buttons work after initial load
        });
        
        // Handle initial image load completion
        const checkInitialLoad = async () => {
            await waitForEditorUnlock();
            const size = editor.getCanvasSize?.();
            if (size?.width && size?.height) {
                lastImageSize = {
                    oldWidth: size.width,
                    oldHeight: size.height,
                    newWidth: size.width,
                    newHeight: size.height
                };
                
                // Fit canvas once after initial load
                if (fittedOnceForSrc !== imageUrl) {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(async () => {
                            await fitCanvasOnce();
                        });
                    });
                    fittedOnceForSrc = imageUrl;
                }
            }
        };
        
        // Sync UI after mount
        queueMicrotask(() => {
            updateUiSize();
            checkInitialLoad();
        });

        // Observe container size changes to keep UI fitted (do not re-fit canvas to avoid crop distortions)
        if (resizeObserver) resizeObserver.disconnect();
        resizeObserver = new ResizeObserver(() => {
            updateUiSize();
        });
        resizeObserver.observe(editorContainer);
    }

    onMount(() => {
        if (open) initEditor();
    });

    afterUpdate(() => {
        if (open && editor == null && editorContainer) {
            initEditor();
        }
        // If the image changes while open, reload it (only if source actually changed)
        if (open && editor && imageUrl && fittedOnceForSrc !== imageUrl) {
            // Wait for editor to be unlocked before loading new image
            waitForEditorUnlock().then(() => {
                // loadImageFromURL returns a promise with image size info
                editor
                    .loadImageFromURL(imageUrl, filename || 'image')
                    .then(async (result: any) => {
                        // Store image size for proper UI resizing
                        if (result) {
                            lastImageSize = {
                                oldWidth: result.oldWidth,
                                oldHeight: result.oldHeight,
                                newWidth: result.newWidth,
                                newHeight: result.newHeight
                            };
                        }
                        
                        // Update UI with image size parameters
                        if (lastImageSize) {
                            try {
                                editor.ui?.resizeEditor({
                                    imageSize: lastImageSize
                                });
                            } catch {}
                        }
                        
                        // Wait for UI to fully paint, then fit once using double rAF
                        requestAnimationFrame(() => {
                            requestAnimationFrame(async () => {
                                await fitCanvasOnce();
                            });
                        });
                        fittedOnceForSrc = imageUrl;
                    })
                    .catch(() => {});
            });
        }
    });

    onDestroy(() => {
        destroyEditor();
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
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

    function handleBackdropClick(e: MouseEvent) {
        // Don't close if user is interacting with the canvas/editor
        if (isInteractingWithCanvas || saving) {
            return;
        }
        closeEditor();
    }

    function handleEditorMouseDown() {
        isInteractingWithCanvas = true;
    }

    function handleEditorMouseUp() {
        // Delay reset to allow click events to complete
        setTimeout(() => {
            isInteractingWithCanvas = false;
        }, 100);
    }
</script>

{#if open}
    <div id="image-editor-modal-root"
        class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/100"
        on:click={handleBackdropClick}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && !isInteractingWithCanvas && closeEditor()}
    >
        <div
            class="relative h-[90vh] w-[90vw] overflow-hidden rounded-lg shadow-2xl outline-0 ring-0"
            class:bg-white={currentTheme === 'light'}
            class:bg-gray-900={currentTheme === 'dark'}
            class:bg-black={currentTheme === 'lightsout'}
            on:click|stopPropagation
            on:mousedown={handleEditorMouseDown}
            on:mouseup={handleEditorMouseUp}
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
    /* Hide everything except the modal while open */
    :global(body.image-editor-open > *:not(#image-editor-modal-root)) {
        visibility: hidden !important;
    }
    /* Remove white border/grid lines around canvas */
    :global(.tui-image-editor-container .tui-image-editor-grid-visual) {
        border: 0 !important;
    }
    :global(.tui-image-editor-container .tui-image-editor-grid-visual table td) {
        border: 0 !important;
    }
    :global(.tui-image-editor),
    :global(.tui-image-editor-container),
    :global(.tui-image-editor-wrap),
    :global(.tui-image-editor-main) {
        border: 0 !important;
        box-shadow: none !important;
    }
    /* Match editor bg to modal bg to hide any seams */
    :global(.tui-image-editor-container) {
        background-color: #1f2937; /* tailwind gray-800 */
    }
    /* Ensure canvas container centers content properly */
    :global(.tui-image-editor-canvas-container) {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }
    /* Make sure the canvas wrapper doesn't overflow */
    :global(.lower-canvas-container) {
        max-width: 100% !important;
        max-height: 100% !important;
    }
    /* Remove inner scrollbars inside editor area */
    :global(.tui-image-editor-container .tui-image-editor-wrap) {
        overflow: hidden !important;
    }
    /* Ensure modal container itself doesn't show scrollbars */
    :global(.tui-image-editor-container) {
        overflow: hidden !important;
    }
    /* Make submenu overlay slightly less opaque to see the image better */
    :global(.tui-image-editor-container .tui-image-editor-submenu .tui-image-editor-submenu-style) {
        opacity: 0.85; /* default 0.95 */
    }
    /* Hide built-in header buttons (Load/Download) to avoid overlap */
    :global(.tui-image-editor-header-buttons) {
        display: none !important;
    }
    /* Hide zoom in/out and hand tool buttons (they don't work properly in modal) */
    :global(.tui-image-editor-header .tui-image-editor-controls) {
        display: none !important;
    }
    /* Fix white line at bottom - ensure no borders or gaps */
    :global(.tui-image-editor-main-container) {
        border: 0 !important;
    }
    :global(.tui-image-editor-wrap),
    :global(.tui-image-editor-main) {
        background-color: transparent !important;
    }
    /* Ensure no white gaps around canvas */
    :global(.tui-image-editor) canvas {
        display: block !important;
    }
</style>
