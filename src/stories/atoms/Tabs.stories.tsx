import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/atoms/tabs'

const meta = {
  title: 'Atoms/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  render: () => (
    <Tabs defaultValue="clinics" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="clinics" className="flex-1">
          Clinics
        </TabsTrigger>
        <TabsTrigger value="doctors" className="flex-1">
          Doctors
        </TabsTrigger>
        <TabsTrigger value="treatments" className="flex-1">
          Treatments
        </TabsTrigger>
      </TabsList>
      <TabsContent value="clinics" className="bg-card rounded-md border p-4 text-sm">
        Browse accredited clinics with transparent pricing and verified reviews.
      </TabsContent>
      <TabsContent value="doctors" className="bg-card rounded-md border p-4 text-sm">
        Discover specialists by expertise, availability, and languages spoken.
      </TabsContent>
      <TabsContent value="treatments" className="bg-card rounded-md border p-4 text-sm">
        Compare treatment options with detailed outcomes and recovery timelines.
      </TabsContent>
    </Tabs>
  ),
}
