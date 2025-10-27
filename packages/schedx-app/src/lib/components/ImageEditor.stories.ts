import type { Meta, StoryObj } from '@storybook/svelte';
import ImageEditor from './ImageEditor.svelte';

const meta = {
  title: 'Components/ImageEditor',
  component: ImageEditor,
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Controls whether the image editor modal is open'
    },
    imageUrl: {
      control: 'text',
      description: 'URL of the image to edit'
    },
    filename: {
      control: 'text',
      description: 'Filename of the image'
    }
  }
} satisfies Meta<typeof ImageEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

// Example story with a sample image
export const Default: Story = {
  args: {
    open: true,
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    filename: 'sample-image.jpg',
    onSave: async (blob: Blob, filename: string) => {
      console.log('Image saved:', filename, blob);
      alert(`Image saved: ${filename} (${blob.size} bytes)`);
    }
  }
};

// Portrait orientation example
export const PortraitImage: Story = {
  args: {
    open: true,
    imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=900',
    filename: 'portrait.jpg',
    onSave: async (blob: Blob, filename: string) => {
      console.log('Image saved:', filename, blob);
    }
  }
};

// Closed state
export const Closed: Story = {
  args: {
    open: false,
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    filename: 'sample-image.jpg'
  }
};
