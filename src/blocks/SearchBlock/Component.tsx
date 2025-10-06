'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type SearchBlockProps = {
  title?: string
}

export const SearchBlock: React.FC<SearchBlockProps> = ({ title }) => {
  const router = useRouter()
  const [services, setServices] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])

  const [formData, setFormData] = useState({
    service: '',
    location: '',
    budget: '',
  })

  useEffect(() => {
    fetch('/api/treatments?limit=100')
      .then((res) => res.json())
      .then((data) => {
        const names = data?.docs?.map((t: any) => t.name).filter(Boolean)
        setServices(names || [])
      })

    fetch('/api/cities?limit=100')
      .then((res) => res.json())
      .then((data) => {
        const names = data?.docs?.map((c: any) => c.name).filter(Boolean)
        setCities(names || [])
      })
  }, [])

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (formData.service) params.set('service', formData.service)
    if (formData.location) params.set('location', formData.location)
    if (formData.budget) params.set('budget', formData.budget)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <section className="py-10">
      <div className="container max-w-4xl">
        {title && <h2 className="text-lg mb-6 font-semibold">{title}</h2>}
        <div className="rounded-2xl p-4 md:p-6 shadow-md bg-white max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="md:border-r md:pr-4 md:w-1/4">
              <label className="block text-sm font-medium text-foreground mb-1">Behandlung</label>
              <Select onValueChange={(val) => setFormData({ ...formData, service: val })}>
                <SelectTrigger className="w-full rounded-none focus:ring-0 ring-0 shadow-none border-none">
                  <SelectValue placeholder="Auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:border-r md:px-4 md:w-1/3">
              <label className="block text-sm font-medium text-foreground mb-1">Ort</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left rounded-none border-none focus:ring-0 shadow-none"
                  >
                    {formData.location || 'Stadt suchen...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 rounded-none rounded-br-2xl border border-border">
                  <Command>
                    <CommandInput
                      placeholder="Search cities..."
                      onValueChange={(val) => {
                        const match = cities.find((c) => c.toLowerCase().startsWith(val.toLowerCase()))
                        if (match) setFormData({ ...formData, location: match })
                      }}
                    />
                    <CommandEmpty>Stand nicht vorhanden</CommandEmpty>
                    <CommandGroup>
                      {cities.map((city) => (
                        <CommandItem key={city} onSelect={() => setFormData({ ...formData, location: city })}>
                          {city}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="md:px-4 md:w-1/4">
              <label className="block text-sm font-medium text-foreground mb-1">Budget</label>
              <Input
                type="number"
                step={100}
                placeholder="e.g. 12000"
                className="border-none shadow-none focus:ring-0 rounded-none"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              />
            </div>

            <div className="md:pl-4 md:w-1/5 flex items-center">
              <Button
                className="w-full whitespace-nowrap hover:bg-secondary hover:text-accent border-none"
                variant="default"
                onClick={handleSearch}
              >
                Search on findmydoc
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
