// src/ai/flows/generate-links-for-pdf.ts
'use server';

/**
 * @fileOverview Generates links between a newly uploaded PDF and existing nodes in a knowledge map.
 *
 * - generateLinksForPdf - A function that suggests links between a PDF and existing nodes.
 * - GenerateLinksForPdfInput - The input type for the generateLinksForPdf function.
 * - GenerateLinksForPdfOutput - The return type for the generateLinksForPdf function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateLinksForPdfInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "The PDF file data as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  existingNodeTitles: z
    .array(z.string())
    .describe('Titles of the existing nodes in the knowledge map.'),
});
export type GenerateLinksForPdfInput = z.infer<typeof GenerateLinksForPdfInputSchema>;

const GenerateLinksForPdfOutputSchema = z.object({
  suggestedLinks: z
    .array(
      z.object({
        targetNodeTitle: z.string().describe('Title of the existing node to link to.'),
        reason: z.string().describe('Reason for suggesting the link.'),
      })
    )
    .describe('Suggested links between the PDF and existing nodes.'),
});
export type GenerateLinksForPdfOutput = z.infer<typeof GenerateLinksForPdfOutputSchema>;

export async function generateLinksForPdf(input: GenerateLinksForPdfInput): Promise<GenerateLinksForPdfOutput> {
  return generateLinksForPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateLinksForPdfPrompt',
  input: {schema: GenerateLinksForPdfInputSchema},
  output: {schema: GenerateLinksForPdfOutputSchema},
  prompt: `You are an AI assistant helping users build knowledge maps.

A user has uploaded a PDF file and wants to find connections between this PDF and their existing knowledge map nodes.

Based on the content of the PDF (represented by the data URI: {{media url=pdfDataUri}}) and the titles of the existing nodes:

Existing Nodes: {{#each existingNodeTitles}}{{{this}}}, {{/each}}

suggest links to existing nodes.

{{#if existingNodeTitles.length}}
Analyze the PDF and suggest links to existing nodes in the knowledge map. For each suggested link, provide a brief reason for the suggestion.
{{else}}
There are no existing nodes to link to.
{{/if}}

Output the suggested links in the following JSON format:

{
  "suggestedLinks": [
    {
      "targetNodeTitle": "Title of the existing node",
      "reason": "Brief reason for suggesting the link"
    }
  ]
}
`,
});

const generateLinksForPdfFlow = ai.defineFlow(
  {
    name: 'generateLinksForPdfFlow',
    inputSchema: GenerateLinksForPdfInputSchema,
    outputSchema: GenerateLinksForPdfOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
