# shadcn/ui Components

Complete set of accessible, customizable UI components built on Radix UI primitives.

## Available Components

### Form Components

#### Input
```tsx
import { Input } from "@/components/ui/input"

<Input type="email" placeholder="Enter your email" />
```

#### Label
```tsx
import { Label } from "@/components/ui/label"

<Label htmlFor="email">Email Address</Label>
<Input id="email" type="email" />
```

#### Select
```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="new">New</SelectItem>
    <SelectItem value="contacted">Contacted</SelectItem>
    <SelectItem value="replied">Replied</SelectItem>
  </SelectContent>
</Select>
```

#### Checkbox
```tsx
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

<div className="flex items-center space-x-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Accept terms and conditions</Label>
</div>
```

### Display Components

#### Badge
```tsx
import { Badge } from "@/components/ui/badge"

<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="info">Info</Badge>
```

#### Card
```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Table
```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
      <TableCell>
        <Badge variant="success">Active</Badge>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Navigation Components

#### Tabs
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="reports">Reports</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    Overview content
  </TabsContent>
  <TabsContent value="analytics">
    Analytics content
  </TabsContent>
  <TabsContent value="reports">
    Reports content
  </TabsContent>
</Tabs>
```

#### Button
```tsx
import { Button } from "@/components/ui/button"

<Button variant="default">Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### Layout Components

#### Separator
```tsx
import { Separator } from "@/components/ui/separator"

<div>
  <p>Section 1</p>
  <Separator className="my-4" />
  <p>Section 2</p>
</div>

// Vertical separator
<div className="flex h-5 items-center">
  <span>Item 1</span>
  <Separator orientation="vertical" className="mx-2" />
  <span>Item 2</span>
</div>
```

### Loading States

#### Skeleton
```tsx
import { Skeleton } from "@/components/ui/skeleton"

<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
  <Skeleton className="h-4 w-[150px]" />
</div>

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton className="h-6 w-[200px]" />
    <Skeleton className="h-4 w-[300px]" />
  </CardHeader>
  <CardContent>
    <Skeleton className="h-[200px] w-full" />
  </CardContent>
</Card>
```

## Theme System

All components use semantic color tokens from CSS variables:

### Colors
- `bg-background` - Main background
- `bg-card` - Card backgrounds
- `bg-primary` - Primary actions (your brand blue)
- `bg-accent` - Accent actions (your brand green)
- `bg-muted` - Subtle backgrounds
- `bg-destructive` - Destructive actions
- `border` - Border color
- `input` - Input border color
- `ring` - Focus ring color

### Text Colors
- `text-foreground` - Main text
- `text-muted-foreground` - Secondary text
- `text-primary` - Primary emphasis
- `text-accent` - Accent emphasis
- `text-card-foreground` - Card text

### Usage Pattern: Form with Validation
```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export function ContactForm() {
  return (
    <form className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="Enter your name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <Button type="submit">Submit</Button>
    </form>
  )
}
```

## Accessibility

All components are built with accessibility in mind:
- ✅ Keyboard navigation
- ✅ Focus indicators
- ✅ ARIA attributes
- ✅ Screen reader support
- ✅ Semantic HTML

## Dark Mode

To enable dark mode, add the `dark` class to your root element:

```tsx
// Toggle dark mode
document.documentElement.classList.toggle('dark')
```

All components automatically adapt to dark mode using CSS variables.

## Customization

Components can be customized using Tailwind utility classes:

```tsx
// Custom styling
<Button className="bg-purple-500 hover:bg-purple-600">
  Custom Button
</Button>

// Responsive sizes
<Input className="w-full md:w-1/2 lg:w-1/3" />

// Custom card
<Card className="border-2 border-primary shadow-lg">
  <CardHeader className="bg-primary/10">
    <CardTitle>Featured</CardTitle>
  </CardHeader>
</Card>
```

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Primitives](https://www.radix-ui.com)
- [Tailwind CSS](https://tailwindcss.com)
