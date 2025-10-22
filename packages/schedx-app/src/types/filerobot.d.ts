declare module 'react-filerobot-image-editor' {
  interface EditorConfig {
    source: string;
    onSave: (editedImageObject: any, designState: any) => void;
    onClose: () => void;
    
    // Tab configuration
    tabsIds?: string[];
    defaultTabId?: string;
    
    // UI configuration
    annotationsCommon?: { fill: string };
    Text?: { text: string };
    Rotate?: { angle: number; componentType: string };
    
    // Tools configuration
    tools?: string[];
    
    // Crop configuration
    Crop?: {
      presetsItems?: Array<{
        titleKey: string;
        descriptionKey: string;
        ratio: number;
      }>;
      presetsFolders?: Array<{
        titleKey: string;
        groups: Array<{
          titleKey: string;
          items: Array<{
            titleKey: string;
            width: number;
            height: number;
            descriptionKey: string;
          }>;
        }>;
      }>;
    };
    
    // Other common options
    [key: string]: any; // Allows for other undocumented options
  }

  class FilerobotImageEditor {
    constructor(container: HTMLElement, options: EditorConfig);
    terminate(): void;
  }

  // Export constants
  const TABS: {
    [key: string]: string;
    ADJUST: string;
    FINETUNE: string;
    FILTERS: string;
    WATERMARK: string;
    ANNOTATE: string;
    RESIZE: string;
  };

  const TOOLS: {
    [key: string]: string;
    TEXT: string;
    CROP: string;
    ROTATE: string;
    // Add other tools as needed
  };

  export default FilerobotImageEditor;
  export { TABS, TOOLS };
}
