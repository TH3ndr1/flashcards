# Next.js Best Practices

In modern web development, simply knowing a little about React, Next.js or Supabase isn't sufficient; you need to master best practices to create robust, maintainable, and scalable applications. This document provides practical best practices to improve your coding skills, readability, and application structure.

## 1. Constants and Hardcoded Values
Avoid embedding magic numbers or strings directly within components. Instead, maintain a dedicated file for constants.

**Example:**
```javascript
// constants.js
export const MAX_FREE_TODOS = 10;

// In component
import { MAX_FREE_TODOS } from './constants';

if (todos.length >= MAX_FREE_TODOS) {
  alert(`You need to upgrade to add more than ${MAX_FREE_TODOS} todos.`);
}
```

## 2. Folder Structure
A clear and consistent folder structure makes your codebase easy to navigate and understand.

Recommended structure:
```
src/
├── components/
│   ├── Header/
│   ├── Sidebar/
│   └── Footer/
├── contexts/
├── lib/
├── hooks/
└── types/
```

**Example:**
```
src/components/Header/Header.jsx
src/hooks/useLocalStorage.js
src/lib/constants.js
src/types/index.js
```

## 3. Component Design Principles
Components should ideally be reusable and maintainable. This practice significantly reduces code duplication.

**Example:**
```jsx
// Button.jsx
export function Button({ children, onClick }) {
  return <button onClick={onClick}>{children}</button>;
}

// Usage
<Button onClick={handleSubmit}>Submit</Button>
```

## 4. Avoid Unnecessary Markup
Avoid unnecessary wrapper elements like `<div>` by using React Fragments.

**Example:**
```jsx
// Bad
return (
  <div>
    <Header />
    <MainContent />
  </div>
);

// Good
return (
  <>
    <Header />
    <MainContent />
  </>
);
```

## 5. Keep Components Layout Agnostic
Reusable components should not contain layout-specific styling. Instead, pass styling through props or external CSS classes.

**Example:**
```jsx
// Button.jsx
export function Button({ children, className, onClick }) {
  return <button className={`base-button ${className}`} onClick={onClick}>{children}</button>;
}

// Usage
<Button className="mt-4">Submit</Button>
```

## 6. Use TypeScript
TypeScript enhances your code quality by catching errors early and providing better autocompletion.

**Example:**
```tsx
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export function Button({ children, onClick }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}
```

## 7. Keep Components Simple ("Dumb")
Separate UI (presentation) components from logic to improve maintainability and testability.

**Example:**
```jsx
// Dumb Component
export function TodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => <li key={todo.id}>{todo.text}</li>)}
    </ul>
  );
}

// Smart Component
export function TodoApp() {
  const [todos, setTodos] = useState([]);

  return <TodoList todos={todos} />;
}
```

## 8. Manage State Effectively
Avoid passing raw state setters; instead, create dedicated event handlers to manage state updates.

**Example:**
```jsx
export function TodoForm({ onAddTodo }) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    onAddTodo(text);
    setText('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button>Add</button>
    </form>
  );
}
```

## 9. Prop Naming Conventions
Follow standard naming conventions, using the `on` prefix for event handler props.

**Example:**
```jsx
// Component
<Button onClick={handleClick}>Click me</Button>

// Definition
export function Button({ onClick, children }) {
  return <button onClick={onClick}>{children}</button>;
}
```

## 10. Performance Optimization with Hooks
Optimize expensive operations or functions that are passed as props with hooks like `useMemo` and `useCallback`.

**Example:**
```jsx
const expensiveCalculation = useMemo(() => calculate(data), [data]);

const handleClick = useCallback(() => {
  alert('Clicked!');
}, []);
```

## 11. State Management Best Practices
Use the functional updater when new state depends on the previous state to ensure consistency and correctness.

**Example:**
```jsx
setCount(prevCount => prevCount + 1);
```

## 12. Consolidate State
Combine related boolean states into a single piece of state using union types.

**Example:**
```jsx
const [status, setStatus] = useState('idle'); // idle | loading | success | error
```

## 13. Single Source of Truth
Maintain one source of truth in your application. Use unique IDs for referencing selected or active items.

**Example:**
```jsx
const [selectedId, setSelectedId] = useState(null);

const selectedTodo = todos.find(todo => todo.id === selectedId);
```

## 14. Leverage URL for State
Store filter states, pagination, or selections in the URL, making it easy to bookmark or share specific states.

**Example:**
```jsx
// URL: /products?color=blue
import { useRouter } from 'next/router';

const { query } = useRouter();
console.log(query.color); // "blue"
```

## 15. Effective use of `useEffect`
Each `useEffect` should address a single concern, clearly isolating side-effects.

**Example:**
```jsx
// Saving to localStorage
useEffect(() => {
  localStorage.setItem('todos', JSON.stringify(todos));
}, [todos]);

// Event listener
useEffect(() => {
  const handleKey = e => { if (e.key === 'Escape') resetForm(); };
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, []);
```

## 16. Data Fetching
Use dedicated data-fetching libraries or Next.js built-in methods rather than directly using `useEffect` for improved caching and performance.

**Example with react-query:**
```jsx
import { useQuery } from 'react-query';

const fetchData = async () => {
  const res = await fetch('/api/data');
  return res.json();
};

const { data, isLoading } = useQuery('fetchData', fetchData);
```

## 17. Improve Structure with Custom Hooks and Utilities
Extract reusable logic into custom hooks and utility functions to keep components focused and clean.

**Example (custom hook):**
```jsx
export function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => {
    const storedValue = localStorage.getItem(key);
    return storedValue ? JSON.parse(storedValue) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
```

## 18. Supabase Best Practices

When integrating Supabase into your Next.js projects, it's crucial to adhere to certain best practices to enhance security, maintainability, and performance.

### 18.1. Secure Your Supabase Credentials

Always store your Supabase keys and URLs in environment variables and never commit them directly into your code repository.

**Example:**
```javascript
// .env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

// In code
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
```

### 18.2. Use Row-Level Security (RLS)

Always enable and configure RLS policies in Supabase to ensure data access is secure and limited to authorized users.

**Example RLS Policy (SQL):**
```sql
-- Allow authenticated users to only access their data
CREATE POLICY "Authenticated users only"
ON your_table FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

### 18.3. Authentication Best Practices

Leverage Supabase authentication with built-in hooks or context providers to centralize authentication logic.

**Example:**
```jsx
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';

export default function Profile() {
  const user = useUser();
  const supabase = useSupabaseClient();

  if (!user) return <div>Please log in</div>;

  return <div>Welcome, {user.email}</div>;
}
```

### 18.4. Use Supabase's Real-time Capabilities Wisely

Supabase real-time subscriptions are powerful but can be resource-intensive. Use them selectively for real-time needs.

**Example:**
```jsx
useEffect(() => {
  const subscription = supabase
    .from('todos')
    .on('INSERT', payload => console.log('New todo:', payload))
    .subscribe();

  return () => subscription.unsubscribe();
}, []);
```

### 18.5. Optimize Database Queries

Limit columns fetched and use server-side filtering and pagination for efficiency.

**Example:**
```javascript
const { data, error } = await supabase
  .from('todos')
  .select('id, content, completed')
  .eq('completed', false)
  .limit(10);
```

### 18.6. Handle Errors Gracefully

Always handle errors returned from Supabase clearly to improve user experience and debugging.

**Example:**
```javascript
const { data, error } = await supabase
  .from('todos')
  .insert([{ content: 'New Todo' }]);

if (error) {
  console.error('Error inserting todo:', error.message);
}
```

### 18.7. Data Validation

Implement client-side and server-side validation to ensure data integrity.

**Client-side Example:**
```jsx
const handleSubmit = async () => {
  if (!content) {
    alert('Content cannot be empty');
    return;
  }

  const { error } = await supabase
    .from('todos')
    .insert({ content });

  if (error) alert(error.message);
};
```

### 18.8. Leverage Supabase Storage Efficiently

Utilize Supabase Storage for handling file uploads and retrievals effectively.

**Example:**
```javascript
// Upload a file
const { data, error } = await supabase.storage
  .from('avatars')
  .upload('user123/avatar.png', file);

// Retrieve a public URL
const { publicURL } = supabase.storage
  .from('avatars')
  .getPublicUrl('user123/avatar.png');
```

### 18.9. Continuous Integration and Deployment

Always test Supabase migrations locally or on a staging environment before pushing changes to production.

**Best Practice:**
- Set up separate Supabase projects for development, staging, and production environments.
- Utilize migration scripts to manage schema changes.

### 18.10. Monitor Usage and Performance

Regularly monitor your Supabase project's usage, query performance, and database size through the Supabase dashboard. Use this information to optimize performance and control costs.

**Best Practice:**
- Check the performance dashboard periodically.
- Optimize slow queries based on metrics provided by Supabase.

### Implications for Earlier Chapters
- **Constants and Hardcoded Values**: Store Supabase table names and query limits in constants.
- **Folder Structure**: Organize your Supabase-related utility functions, hooks, and contexts clearly within their respective directories.
- **Performance Optimization**: Use Supabase client caching mechanisms wisely, and complement with React Query to cache frequently accessed data.
- **State Management Best Practices**: Keep authentication states and fetched data clearly managed within contexts or state management solutions.

Following these practices will help you leverage Supabase effectively, maintaining high standards for security, performance, and maintainability in your Next.js applications.

# Best Practice in Next.js: Separating Presentation, Business Logic, and Data Layer

Separating concerns into **presentation**, **business logic**, and **data layers** is widely considered a **best practice** in Next.js and modern frontend development. The extent to which this separation is applied depends on your app's **complexity**, **team size**, and **long-term goals**.

---

## 1. Presentation Layer

**What it is**: UI components ("dumb components") responsible for rendering the interface.

**Best practices**:
- Keep components as **stateless** as possible.
- Avoid embedding business or data-fetching logic.
- Make them **reusable** and **pure** (output = f(input)).

**Where**:
- Place inside `components/`  
  _Example: `components/UserCard.tsx`_

---

## 2. Business Logic Layer

**What it is**: Logic that manipulates, transforms, or interprets data before it reaches the UI.

**Best practices**:
- Use **custom hooks** or **utility functions**.
- Avoid putting this logic directly in UI components.
- Easier to **test**, **reuse**, and **maintain**.

**Where**:
- Place in `hooks/` or `lib/` / `utils/`  
  _Examples: `hooks/useUserPermissions.ts`, `utils/formatDate.ts`_

---

## 3. Data Layer

**What it is**: Data fetching, mutations, and caching.

**Best practices**:
- Use a dedicated **API layer**.
- Encapsulate data access (REST, GraphQL, etc.).
- Use libraries like **React Query**, **SWR**, or **tRPC** for enhanced data management.

**Where**:
- Place in `services/` or `api/`  
  _Examples: `services/getUser.ts`, `services/createInvoice.ts`_

---

## In Next.js Context

### Page-Level Separation

- Use **Server Components**, `getServerSideProps`, or `getStaticProps` for data fetching.
- Pass clean props down to presentational components.

### Example Folder Structure:

```
pages/
  users/
    [id].tsx            ← Page: fetches data, renders view
components/
  UserProfile.tsx       ← Presentational component
hooks/
  useUserProfile.ts     ← Business logic (custom hook)
services/
  users.ts              ← Data fetching (e.g., API calls)
```

### API Routes

If you're using **Next.js as a backend**, keep your backend logic inside:

```
pages/api/
```

---

## When Strict Separation Matters

- Large, long-term projects.
- Multiple devs or teams.
- Shared logic, growing component complexity.
- Need for testability and maintainability.

---

## When It Might Be Overkill

- Small apps or MVPs.
- Solo projects with short timelines.
- Prototypes or proofs of concept.

---

## Summary

For **scalable**, **maintainable**, and **testable** Next.js applications, separating concerns is a **smart architectural decision**. It adds structure and clarity as your codebase grows.

---

Let me know if you want a code-based example or a GitHub folder template!

## 25. Authentication in Dynamic Routes (Next.js App Router)

When handling authentication in Next.js applications, especially with dynamic routes like `/study/[deckId]`, follow these best practices:

### Using `@supabase/ssr` Package

The official `@supabase/ssr` package is recommended over `auth-helpers-nextjs` due to better handling of cookie formats, especially the Supabase `base64-` prefixed cookies.

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerClient() {
  // Implementation details...
}
```

### Proper Async Cookie Handling

Always make cookie handling fully asynchronous in dynamic routes to avoid Next.js warnings. Await the `cookies()` function itself:

```typescript
// Correct pattern - fully async
async get(name: string) {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(name)?.value
  } catch (error) {
    console.error(`Error accessing cookie: ${error}`)
    return undefined
  }
}
```

### Middleware Configuration

Configure middleware to handle session refresh while excluding static assets and API routes that don't need authentication:

```typescript
// middleware.ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
```

### Client Functions for Different Contexts

Create distinct client functions for different contexts to maintain clear separation of concerns:

```typescript
// lib/supabase/server.ts
export function createServerClient() { /* For Server Components */ }
export function createActionClient() { /* For Server Actions */ }
export function createBrowserClient() { /* For Client Components */ }
```

By following these best practices, you'll ensure consistent and secure authentication handling across all parts of your Next.js application, including dynamic routes.