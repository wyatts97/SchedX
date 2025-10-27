# Storybook Configuration

This directory contains the Storybook configuration for the SchedX app.

## Files

- **main.ts** - Main Storybook configuration
  - Defines story locations
  - Configures addons
  - Sets up SvelteKit framework integration
  
- **preview.ts** - Preview configuration
  - Imports global styles (Tailwind CSS)
  - Configures theme backgrounds
  - Sets up controls and parameters

## Running Storybook

### Development Mode
```bash
npm run storybook:dev
```
This starts Storybook on http://localhost:6006

### Build Static Version
```bash
npm run storybook:build
```
This creates a static build in `storybook-static/` directory

## Creating Stories

Stories should be placed next to their components with the `.stories.ts` or `.stories.svelte` extension.

### Example Story File

```typescript
import type { Meta, StoryObj } from '@storybook/svelte';
import MyComponent from './MyComponent.svelte';

const meta = {
  title: 'Components/MyComponent',
  component: MyComponent,
  tags: ['autodocs'],
  argTypes: {
    prop1: {
      control: 'text',
      description: 'Description of prop1'
    }
  }
} satisfies Meta<MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    prop1: 'value'
  }
};
```

## Addons Included

- **@storybook/addon-links** - Link between stories
- **@storybook/addon-essentials** - Essential addons bundle
  - Controls - Interactive controls for props
  - Actions - Log component events
  - Viewport - Test responsive designs
  - Backgrounds - Change background colors
  - Docs - Auto-generated documentation
- **@storybook/addon-interactions** - Test user interactions

## Tips

1. Use `tags: ['autodocs']` to auto-generate documentation
2. Add descriptive `argTypes` for better controls
3. Create multiple stories per component for different states
4. Use MDX files for rich documentation pages
