# FileUpload Component

A comprehensive, accessible file upload component with drag-and-drop support, file validation, progress tracking, and error handling.

## Features

### ✅ **Accessibility**

- Full keyboard navigation support
- ARIA labels and roles
- Screen reader friendly
- Focus management
- High contrast support

### ✅ **File Validation**

- File type validation (images and videos)
- File size limits
- Duplicate file detection
- Maximum file count limits

### ✅ **User Experience**

- Drag and drop interface
- Visual feedback for drag states
- Progress tracking with animated progress bar
- File previews with thumbnails
- Status indicators (ready, uploading, uploaded, error)
- Responsive design

### ✅ **Error Handling**

- Comprehensive error messages
- Per-file error states
- Network error handling
- Timeout handling
- Validation error display

### ✅ **Performance**

- Memory leak prevention (blob URL cleanup)
- Efficient file processing
- Optimized re-renders
- Lazy loading of previews

### ✅ **Type Safety**

- Full TypeScript support
- Strict type definitions
- Interface contracts
- Event type safety

## Props

| Prop            | Type       | Default                  | Description                              |
| --------------- | ---------- | ------------------------ | ---------------------------------------- |
| `disabled`      | `boolean`  | `false`                  | Disables the entire component            |
| `maxFiles`      | `number`   | `4`                      | Maximum number of files allowed          |
| `maxFileSize`   | `number`   | `50 * 1024 * 1024`       | Maximum file size in bytes (50MB)        |
| `acceptedTypes` | `string[]` | `['image/*', 'video/*']` | Accepted MIME types                      |
| `showPreview`   | `boolean`  | `true`                   | Show file previews                       |
| `autoUpload`    | `boolean`  | `false`                  | Automatically upload files when selected |

## Events

| Event            | Payload                              | Description                                         |
| ---------------- | ------------------------------------ | --------------------------------------------------- |
| `changeMedia`    | `{ url: string; type: string }[]`    | Fired when media files change (only uploaded files) |
| `uploadStart`    | `void`                               | Fired when upload begins                            |
| `uploadComplete` | `void`                               | Fired when upload completes successfully            |
| `uploadError`    | `{ message: string; file?: string }` | Fired when upload fails                             |

## Usage

### Basic Usage

```svelte
<script>
	import FileUpload from '$lib/components/FileUpload.svelte';

	function handleMediaChange(event) {
		console.log('Media changed:', event.detail);
	}
</script>

<FileUpload on:changeMedia={handleMediaChange} />
```

### Advanced Usage

```svelte
<script>
  import FileUpload from '$lib/components/FileUpload.svelte';

  let uploadedMedia = [];

  function handleMediaChange(event) {
    uploadedMedia = event.detail;
  }

  function handleUploadStart() {
    console.log('Upload started');
  }

  function handleUploadComplete() {
    console.log('Upload completed');
  }

  function handleUploadError(event) {
    console.error('Upload failed:', event.detail.message);
  }
</script>

<FileUpload
  maxFiles={4}
  maxFileSize={25 * 1024 * 1024} // 25MB
  autoUpload={true}
  on:changeMedia={handleMediaChange}
  on:uploadStart={handleUploadStart}
  on:uploadComplete={handleUploadComplete}
  on:uploadError={handleUploadError}
/>
```

## File Validation

The component validates files based on:

### Supported File Types

- **Images**: JPEG, PNG, GIF, WebP
- **Videos**: MP4, WebM, MOV

### Validation Rules

1. **File Size**: Must be under `maxFileSize` (default: 50MB)
2. **File Type**: Must be in the allowed MIME types
3. **Duplicate Detection**: Prevents selecting the same file twice
4. **File Count**: Respects `maxFiles` limit

## Error Handling

### Validation Errors

- File too large
- Unsupported file type
- Duplicate file
- Too many files

### Upload Errors

- Network errors
- Server errors
- Timeout errors
- File processing errors

## Accessibility Features

### Keyboard Navigation

- `Tab`: Navigate through interactive elements
- `Enter/Space`: Activate buttons and drop zone
- `Escape`: Close modals or cancel operations

### Screen Reader Support

- Descriptive ARIA labels
- Status announcements
- Error message announcements
- Progress updates

### Visual Indicators

- Focus states for all interactive elements
- High contrast support
- Clear visual feedback for drag states
- Status indicators with icons and colors

## Performance Optimizations

### Memory Management

- Automatic cleanup of blob URLs
- Proper disposal of file objects
- Efficient array operations

### Rendering Optimizations

- Conditional rendering of previews
- Debounced state updates
- Minimal re-renders

## Styling

The component uses Tailwind CSS classes and supports:

- Light and dark themes
- Responsive design
- Custom color schemes
- Consistent spacing and typography

## Browser Support

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Features Used**: File API, Drag and Drop API, Fetch API
- **Fallbacks**: Graceful degradation for older browsers

## Security Considerations

- File type validation on both client and server
- Size limits enforced on both client and server
- No file content inspection (privacy)
- Secure file upload endpoints
- CSRF protection (handled by server)

## Troubleshooting

### Common Issues

1. **Files not uploading**
   - Check network connection
   - Verify server endpoint is accessible
   - Check file size and type restrictions

2. **Preview not showing**
   - Ensure `showPreview` is true
   - Check if file type is supported
   - Verify blob URL creation

3. **Drag and drop not working**
   - Check browser support
   - Verify event handlers are attached
   - Check for conflicting CSS

### Debug Mode

Add console logging for debugging:

```javascript
// In the component, add:
console.log('File validation:', validation);
console.log('Upload response:', response);
```

## Future Enhancements

### Planned Features

- [ ] Chunked upload for large files
- [ ] Image compression before upload
- [ ] Video thumbnail generation
- [ ] Upload retry mechanism
- [ ] Batch upload operations
- [ ] Custom file type icons
- [ ] Upload queue management

### Potential Improvements

- [ ] Web Workers for file processing
- [ ] Service Worker for offline support
- [ ] Progressive Web App features
- [ ] Advanced file validation (content inspection)
- [ ] Upload resume capability
- [ ] Multi-part upload support
