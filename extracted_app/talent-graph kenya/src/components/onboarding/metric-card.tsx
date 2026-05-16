
'use client';

import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Metric } from '@/lib/metrics';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';


interface MetricCardProps {
  metric: Metric;
}

export function MetricCard({ metric }: MetricCardProps) {
  const { control } = useFormContext();

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{metric.name}</span>
           {!metric.required && (
            <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-1 rounded-full">Optional</span>
          )}
        </CardTitle>
        <CardDescription>{metric.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        <FormField
          control={control}
          name={metric.id}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your Measurement</FormLabel>
              <div className="relative">
                <FormControl>
                   <Input 
                      type="number" 
                      placeholder={`e.g., ${metric.poor}`} 
                      step="any"
                      {...field}
                      value={field.value ?? ''}
                    />
                </FormControl>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {metric.unit}
                </span>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Accordion type="single" collapsible className="w-full mt-4">
          <AccordionItem value="item-1" className="border-t">
            <AccordionTrigger className="text-sm py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    <span>Explanation & Benchmarks</span>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 text-sm space-y-4">
               <div>
                <h4 className="font-semibold">How to Test</h4>
                <p className="text-muted-foreground">{metric.howToTest}</p>
              </div>
               <div>
                <h4 className="font-semibold">Why It Matters</h4>
                <p className="text-muted-foreground">{metric.whyItMatters}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="font-semibold text-base">{metric.poor}</p>
                  <p className="text-xs text-muted-foreground">Baseline</p>
                </div>
                <div>
                  <p className="font-semibold text-base">{metric.elite}</p>
                  <p className="text-xs text-muted-foreground">Elite</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
