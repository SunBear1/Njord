---
description: React composition patterns for scalable components. Apply when refactoring components with boolean props, building reusable component APIs, or designing flexible architecture.
globs: "src/components/**/*.tsx"
---

# React Composition Patterns

Composition patterns for building flexible, maintainable React components.
Source: [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) (MIT)

## When to Apply

- Refactoring components with many boolean props
- Building reusable component APIs
- Designing flexible component architecture
- Reviewing component architecture for scalability

## Core Principle

Avoid boolean prop proliferation. Each boolean doubles possible states and
creates unmaintainable conditional logic. Use composition instead.

## 1. Component Architecture (HIGH)

### 1.1 Avoid Boolean Prop Proliferation

Don't add boolean props like `isThread`, `isEditing`, `showHeader` to customize behavior.

**Bad:**
```tsx
function Panel({ showHeader, showFooter, isCompact, isEditing }: Props) {
  return (
    <div>
      {showHeader && <Header compact={isCompact} />}
      <Content editing={isEditing} />
      {showFooter && <Footer />}
    </div>
  );
}
```

**Good — use composition:**
```tsx
function CompactPanel() {
  return (
    <Panel.Frame>
      <Panel.Content />
    </Panel.Frame>
  );
}

function FullPanel() {
  return (
    <Panel.Frame>
      <Panel.Header />
      <Panel.Content />
      <Panel.Footer />
    </Panel.Frame>
  );
}
```

### 1.2 Use Compound Components

Structure complex components with shared context. Consumers compose the pieces they need.

```tsx
const PanelContext = createContext<PanelContextValue | null>(null);

function PanelFrame({ children }: { children: React.ReactNode }) {
  return <div className="panel">{children}</div>;
}

function PanelHeader() {
  const { title } = use(PanelContext);
  return <h2>{title}</h2>;
}

const Panel = {
  Frame: PanelFrame,
  Header: PanelHeader,
  Content: PanelContent,
  Footer: PanelFooter,
};
```

## 2. State Management (MEDIUM)

### 2.1 Decouple State from UI

The provider is the only place that knows how state is managed. UI components consume a context interface.

```tsx
interface ContextValue {
  state: State;
  actions: Actions;
  meta: Meta;
}
```

Different providers can implement the same interface — the UI works with any of them.

### 2.2 Lift State into Providers

Move state into provider components for sibling access. Don't prop-drill through intermediate components.

## 3. Implementation Patterns (MEDIUM)

### 3.1 Create Explicit Variants

Instead of `<Button primary />` vs `<Button secondary />`, create `<PrimaryButton />` and `<SecondaryButton />`.

### 3.2 Prefer Children Over Render Props

Use `children` for composition instead of `renderX` props. Children are more flexible and composable.

## 4. React 19 APIs

> This project uses React 19.

- **Don't use `forwardRef`** — pass `ref` as a regular prop.
- **Use `use()` instead of `useContext()`** — React 19's `use()` hook.
