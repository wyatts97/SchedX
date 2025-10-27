import type { Preview } from '@storybook/svelte';
import '../src/app.css'; // Import Tailwind CSS

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff'
        },
        {
          name: 'dark',
          value: '#1f2937'
        },
        {
          name: 'lightsout',
          value: '#000000'
        }
      ]
    }
  }
};

export default preview;