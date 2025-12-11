# Superforms Guide

SchedX uses [sveltekit-superforms](https://superforms.rocks/) for type-safe, progressively enhanced form handling.

## Why Superforms?

| Feature | Before (Manual) | After (Superforms) |
|---------|-----------------|-------------------|
| Validation | Manual Zod calls | Automatic client + server |
| Loading states | Manual `loading` variable | Built-in `$submitting`, `$delayed` |
| Error handling | Manual error object | Automatic `$errors` per field |
| Progressive enhancement | Requires JavaScript | Works without JS |
| Type safety | Partial | Full end-to-end |

## Quick Start

### 1. Define Schema

Schemas are already in `$lib/validation/schemas.ts`:

```typescript
// $lib/validation/schemas.ts
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});
```

### 2. Create Server Load + Action

```typescript
// +page.server.ts
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/validation/schemas';
import { fail, redirect } from '@sveltejs/kit';

export const load = async () => {
  // Initialize empty form
  const form = await superValidate(zod(loginSchema));
  return { form };
};

export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod(loginSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    // Process form data
    const { username, password } = form.data;
    
    // Return error message
    if (authFailed) {
      return message(form, 'Invalid credentials', { status: 401 });
    }
    
    // Success - redirect
    throw redirect(302, '/dashboard');
  }
};
```

### 3. Create Form Component

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import type { PageData } from './$types';
  
  export let data: PageData;
  
  const { form, errors, message, enhance, submitting } = superForm(data.form);
</script>

<!-- use:enhance enables progressive enhancement -->
<form method="POST" use:enhance>
  <!-- Global error message -->
  {#if $message}
    <div class="error">{$message}</div>
  {/if}
  
  <!-- Field with validation -->
  <input name="username" bind:value={$form.username} />
  {#if $errors.username}
    <span class="error">{$errors.username}</span>
  {/if}
  
  <button disabled={$submitting}>
    {$submitting ? 'Loading...' : 'Submit'}
  </button>
</form>
```

## Available Stores

| Store | Type | Description |
|-------|------|-------------|
| `$form` | Object | Current form values |
| `$errors` | Object | Field-level errors |
| `$message` | String | Global form message |
| `$submitting` | Boolean | True during submission |
| `$delayed` | Boolean | True after `delayMs` |
| `$tainted` | Object | Which fields have been modified |
| `$valid` | Boolean | Overall form validity |

## Common Patterns

### Pre-populate Form

```typescript
// +page.server.ts
export const load = async ({ params }) => {
  const user = await db.getUser(params.id);
  const form = await superValidate(user, zod(userSchema));
  return { form };
};
```

### Multiple Forms on One Page

```typescript
// +page.server.ts
export const load = async () => {
  return {
    loginForm: await superValidate(zod(loginSchema)),
    registerForm: await superValidate(zod(registerSchema))
  };
};

export const actions = {
  login: async ({ request }) => { /* ... */ },
  register: async ({ request }) => { /* ... */ }
};
```

```svelte
<form method="POST" action="?/login" use:enhance>
  <!-- login form -->
</form>

<form method="POST" action="?/register" use:enhance>
  <!-- register form -->
</form>
```

### Client-Side Validation

```svelte
<script>
  import { superForm } from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { mySchema } from '$lib/validation/schemas';
  
  const { form, errors, enhance } = superForm(data.form, {
    validators: zodClient(mySchema),
    validationMethod: 'oninput' // or 'onblur', 'submit-only'
  });
</script>
```

### Custom Submit Handler

```svelte
<script>
  const { form, enhance } = superForm(data.form, {
    onSubmit: ({ formData, cancel }) => {
      // Modify form data or cancel submission
      if (someCondition) cancel();
    },
    onResult: ({ result }) => {
      // Handle result (success, failure, redirect, error)
      if (result.type === 'success') {
        toast.success('Saved!');
      }
    },
    onError: ({ result }) => {
      toast.error(result.error.message);
    }
  });
</script>
```

### File Uploads

```typescript
// Schema
const uploadSchema = z.object({
  file: z.instanceof(File).refine(f => f.size < 5_000_000, 'Max 5MB')
});

// +page.server.ts
export const actions = {
  default: async ({ request }) => {
    const formData = await request.formData();
    const form = await superValidate(formData, zod(uploadSchema));
    // form.data.file is the File object
  }
};
```

## Migration Guide

### Converting Existing Forms

**Before:**
```svelte
<script>
  let loading = false;
  let error = '';
  let username = '';
  
  async function handleSubmit() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username })
      });
      if (!res.ok) error = 'Failed';
    } finally {
      loading = false;
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input bind:value={username} />
  {#if error}<span>{error}</span>{/if}
  <button disabled={loading}>Submit</button>
</form>
```

**After:**
```svelte
<script>
  import { superForm } from 'sveltekit-superforms';
  export let data;
  const { form, errors, message, enhance, submitting } = superForm(data.form);
</script>

<form method="POST" use:enhance>
  <input name="username" bind:value={$form.username} />
  {#if $errors.username}<span>{$errors.username}</span>{/if}
  {#if $message}<span>{$message}</span>{/if}
  <button disabled={$submitting}>Submit</button>
</form>
```

## Example: Login Page

See the working example at `/login-superforms`:
- `src/routes/login-superforms/+page.svelte`
- `src/routes/login-superforms/+page.server.ts`

## Resources

- [Superforms Documentation](https://superforms.rocks/)
- [Superforms GitHub](https://github.com/ciscoheat/sveltekit-superforms)
- [Zod Documentation](https://zod.dev/)
