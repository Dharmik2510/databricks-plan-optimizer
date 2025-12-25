# BrickOptima Design System

A comprehensive, accessible, and themeable design system built with React, TypeScript, Tailwind CSS, and Radix UI primitives.

## 📚 Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [Components](#components)
- [Tokens & Theme](#tokens--theme)
- [Utilities](#utilities)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The BrickOptima Design System provides a consistent, accessible, and beautiful user interface for the Databricks query optimization platform. It's built with:

- **React 19**: Latest React features with TypeScript
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Dark Mode**: Full support for light/dark themes

### Key Features

✅ **Fully Typed**: Complete TypeScript support with type inference
✅ **Accessible**: WCAG 2.1 AA compliant with keyboard navigation
✅ **Themeable**: Light/dark mode with customizable tokens
✅ **Responsive**: Mobile-first design with breakpoints
✅ **Tree-shakeable**: Import only what you need

## Installation

The design system is already installed as part of the frontend package. To use it:

```tsx
import { Button, Card, Badge } from '../design-system/components';
import { cn, formatCurrency } from '../design-system/utils';
import { colors, spacing } from '../design-system/tokens';
```

### Dependencies

```json
{
  "tailwindcss": "^3.x",
  "@radix-ui/react-dialog": "^1.x",
  "@radix-ui/react-tooltip": "^1.x",
  "@radix-ui/react-progress": "^1.x",
  "clsx": "^2.x",
  "tailwind-merge": "^2.x"
}
```

## Core Concepts

### Design Tokens

Design tokens are the visual design atoms of the system. They define colors, spacing, typography, and more.

```tsx
import { colors, spacing, typography } from './design-system/tokens';

// Use tokens directly
<div style={{ color: colors.primary[600], padding: spacing.md }}>
  Hello World
</div>
```

### Theme System

Supports light and dark modes with automatic switching:

```tsx
import { ThemeProvider, useTheme } from './ThemeContext';

function MyComponent() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme}>
      {isDark ? 'Light' : 'Dark'} Mode
    </button>
  );
}
```

### Utility Functions

The `cn()` utility combines class names with Tailwind merge:

```tsx
import { cn } from './design-system/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  'override-class'
)}>
  Content
</div>
```

## Components

### Button

Versatile button component with multiple variants and sizes.

```tsx
import { Button } from './design-system/components';
import { Sparkles } from 'lucide-react';

<Button
  variant="primary"
  size="md"
  leftIcon={<Sparkles />}
  onClick={handleClick}
>
  Analyze Query
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
- `size`: 'sm' | 'md' | 'lg'
- `isLoading`: boolean
- `leftIcon`, `rightIcon`: React.ReactNode
- `fullWidth`: boolean

### Card

Container component with variants and sub-components.

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './design-system/components';

<Card hoverable padding="md">
  <CardHeader>
    <CardTitle>Analysis Results</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Your query can be optimized...</p>
  </CardContent>
  <CardFooter>
    <Button>View Details</Button>
  </CardFooter>
</Card>
```

**Props:**
- `variant`: 'default' | 'outlined' | 'elevated'
- `padding`: 'none' | 'sm' | 'md' | 'lg'
- `hoverable`: boolean

### Badge

Status and severity indicators.

```tsx
import { Badge } from './design-system/components';

<Badge severity="CRITICAL" dot>
  High Priority
</Badge>

<Badge status="PROCESSING">
  Analyzing...
</Badge>

<Badge variant="success">
  Completed
</Badge>
```

**Props:**
- `variant`: 'default' | 'success' | 'warning' | 'error' | 'info'
- `severity`: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
- `status`: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
- `size`: 'sm' | 'md' | 'lg'
- `dot`: boolean
- `removable`: boolean

### Input

Accessible form input with validation.

```tsx
import { Input } from './design-system/components';
import { Search } from 'lucide-react';

<Input
  label="Search Analyses"
  placeholder="Type to search..."
  leftIcon={<Search />}
  error={errors.search}
  helperText="Search by title or content"
/>
```

**Props:**
- `label`: string
- `error`: string
- `helperText`: string
- `leftIcon`, `rightIcon`: React.ReactNode
- `fullWidth`: boolean

### Modal

Accessible dialog component built on Radix UI.

```tsx
import { Modal, ModalFooter } from './design-system/components';

<Modal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Confirm Action"
  description="Are you sure you want to proceed?"
  size="md"
>
  <p>This action cannot be undone.</p>

  <ModalFooter>
    <Button variant="secondary" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="danger" onClick={handleConfirm}>
      Confirm
    </Button>
  </ModalFooter>
</Modal>
```

**Props:**
- `open`: boolean
- `onOpenChange`: (open: boolean) => void
- `title`: string
- `description`: string
- `size`: 'sm' | 'md' | 'lg' | 'xl' | 'full'
- `showCloseButton`: boolean

### Tooltip

Context-aware tooltips built on Radix UI.

```tsx
import { Tooltip } from './design-system/components';
import { Info } from 'lucide-react';

<Tooltip content="This shows the query execution plan" side="top">
  <Info className="h-4 w-4 cursor-help" />
</Tooltip>
```

**Props:**
- `content`: React.ReactNode
- `side`: 'top' | 'right' | 'bottom' | 'left'
- `align`: 'start' | 'center' | 'end'
- `delayDuration`: number

### Progress

Linear and step-based progress indicators.

```tsx
import { Progress, ProgressSteps } from './design-system/components';

// Linear progress
<Progress
  value={75}
  max={100}
  variant="success"
  showLabel
  label="Analyzing query"
/>

// Step-based progress
<ProgressSteps steps={[
  { label: 'Parsing plan', status: 'completed', duration: '1s' },
  { label: 'Building DAG', status: 'current' },
  { label: 'Optimizing', status: 'pending' },
]} />
```

### Skeleton

Loading placeholders with multiple presets.

```tsx
import { Skeleton, SkeletonCard, SkeletonList, SkeletonDAG } from './design-system/components';

// Basic skeleton
<Skeleton variant="text" width="60%" height="1rem" />

// Preset skeletons
<SkeletonCard />
<SkeletonList items={5} />
<SkeletonDAG />
```

### Toast

Toast notifications with context provider.

```tsx
import { ToastProvider, useToast } from './design-system/components';

// In your root component
<ToastProvider>
  <App />
</ToastProvider>

// In any component
function MyComponent() {
  const { addToast } = useToast();

  const handleSuccess = () => {
    addToast({
      title: 'Analysis Complete',
      description: 'Your query has been optimized',
      type: 'success',
      duration: 5000,
    });
  };
}
```

## Tokens & Theme

### Color Palette

```tsx
import { colors } from './design-system/tokens';

// Primary colors (Blue)
colors.primary[50]  // Lightest
colors.primary[500] // Base
colors.primary[900] // Darkest

// Severity colors
colors.severity.low      // #10B981 (Green)
colors.severity.medium   // #F59E0B (Amber)
colors.severity.high     // #EF4444 (Red)
colors.severity.critical // #7C2D12 (Dark Red)

// DAG node colors
colors.dagNode.scan      // Blue
colors.dagNode.join      // Purple
colors.dagNode.filter    // Cyan
colors.dagNode.aggregate // Amber
colors.dagNode.write     // Green
colors.dagNode.shuffle   // Red
```

### Spacing Scale

```tsx
import { spacing } from './design-system/tokens';

spacing.xs   // 4px
spacing.sm   // 8px
spacing.md   // 16px
spacing.lg   // 24px
spacing.xl   // 32px
spacing['2xl'] // 40px
```

### Typography

```tsx
import { typography } from './design-system/tokens';

typography.fontSize.xs   // 0.75rem
typography.fontSize.base // 1rem
typography.fontSize['2xl'] // 1.5rem

typography.fontWeight.normal   // 400
typography.fontWeight.semibold // 600
typography.fontWeight.bold     // 700
```

### Theme Classes

Pre-defined class combinations for theme-aware styling:

```tsx
import { themeClasses, severityClasses, statusClasses } from './design-system/theme';

// Button classes
<button className={themeClasses.button.primary.light}>
  Primary Button
</button>

// Severity classes
<span className={severityClasses.CRITICAL}>
  Critical Issue
</span>

// Status classes
<span className={statusClasses.PROCESSING}>
  Processing...
</span>
```

## Utilities

### Formatting Functions

```tsx
import {
  formatBytes,
  formatDuration,
  formatCurrency,
  formatNumber,
  formatPercentage,
  getRelativeTime
} from './design-system/utils';

formatBytes(1073741824)        // "1 GB"
formatDuration(90000)          // "1.5m"
formatCurrency(123.45)         // "$123.45"
formatNumber(1234567)          // "1,234,567"
formatPercentage(0.8534)       // "85.3%"
getRelativeTime(new Date())    // "just now"
```

### Helper Functions

```tsx
import {
  getSeverityColor,
  getDagNodeColor,
  debounce,
  throttle,
  copyToClipboard,
  generateId
} from './design-system';

// Get color by severity
const color = getSeverityColor('CRITICAL'); // #7C2D12

// Get DAG node color by type
const nodeColor = getDagNodeColor('SortMergeJoin'); // #8B5CF6 (purple)

// Debounce function
const debouncedSearch = debounce(handleSearch, 300);

// Copy to clipboard
await copyToClipboard('Text to copy');

// Generate unique ID
const id = generateId('analysis'); // "analysis_abc123def"
```

## Best Practices

### 1. Use Design Tokens

❌ **Bad:**
```tsx
<div style={{ color: '#2196F3', padding: '16px' }}>
```

✅ **Good:**
```tsx
<div style={{ color: colors.primary[500], padding: spacing.md }}>
```

### 2. Combine Classes with `cn()`

❌ **Bad:**
```tsx
<div className={`base ${isActive ? 'active' : ''} ${className}`}>
```

✅ **Good:**
```tsx
<div className={cn('base', isActive && 'active', className)}>
```

### 3. Use Semantic Components

❌ **Bad:**
```tsx
<div className="bg-red-500 text-white px-4 py-2 rounded">
  Delete
</div>
```

✅ **Good:**
```tsx
<Button variant="danger">
  Delete
</Button>
```

### 4. Leverage Theme Classes

❌ **Bad:**
```tsx
<span className={isDark ? 'text-green-400' : 'text-green-800'}>
  Success
</span>
```

✅ **Good:**
```tsx
<Badge variant="success">
  Success
</Badge>
```

### 5. Accessibility First

Always include:
- Proper ARIA attributes
- Keyboard navigation support
- Focus indicators
- Screen reader text

```tsx
<button
  aria-label="Close modal"
  aria-pressed={isOpen}
  onClick={handleClose}
>
  <X className="h-4 w-4" />
  <span className="sr-only">Close</span>
</button>
```

## Examples

### Complete Form Example

```tsx
import { Input, Button, Card, CardContent } from './design-system/components';
import { Mail, Lock } from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  return (
    <Card padding="lg" className="max-w-md mx-auto">
      <CardContent>
        <h2 className="text-2xl font-bold mb-6">Sign In</h2>

        <form className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            leftIcon={<Mail className="h-5 w-5" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            fullWidth
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter password"
            leftIcon={<Lock className="h-5 w-5" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            fullWidth
          />

          <Button variant="primary" fullWidth>
            Sign In
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Dashboard Stats Example

```tsx
import { Card, CardContent, Badge } from './design-system/components';
import { TrendingUp, DollarSign } from 'lucide-react';
import { formatCurrency, formatNumber } from './design-system/utils';

function StatsCard({ title, value, change, icon, trend }) {
  return (
    <Card hoverable>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <div className="flex items-center gap-2 mt-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">{change}</span>
            </div>
          </div>
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatsCard
        title="Total Savings"
        value={formatCurrency(24560)}
        change="+12.5%"
        icon={<DollarSign className="h-6 w-6 text-primary-600" />}
      />
      {/* More stats... */}
    </div>
  );
}
```

## Contributing

When adding new components:

1. Follow existing patterns and naming conventions
2. Add TypeScript types for all props
3. Include JSDoc comments for public APIs
4. Support light/dark themes
5. Ensure accessibility (ARIA, keyboard nav)
6. Add examples to this README

## License

MIT © BrickOptima Team

---

For more examples and detailed API documentation, see the individual component files in `/design-system/components/`.
