
'use server';
/**
 * @fileOverview A Genkit flow to search nodes in a knowledge map using an AI model.
 *
 * - searchKnowledgeMap - A function that identifies nodes relevant to a search query.
 * - SearchKnowledgeMapInput - The input type for the searchKnowledgeMap function.
 * - SearchKnowledgeMapOutput - The return type for the searchKnowledgeMap function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NodeInfoSchema = z.object({
  id: z.string().describe('The unique identifier of the node.'),
  title: z.string().describe('The title or primary label of the node.'),
});

const SearchKnowledgeMapInputSchema = z.object({
  searchQuery: z.string().describe('The user_s search query.'),
  nodes: z.array(NodeInfoSchema).describe('A list of nodes available in the knowledge map, each with an ID and a title.'),
});
export type SearchKnowledgeMapInput = z.infer<typeof SearchKnowledgeMapInputSchema>;

const SearchKnowledgeMapOutputSchema = z.object({
  relevantNodeIds: z.array(z.string()).describe('An array of IDs of the nodes deemed most relevant to the search query.'),
});
export type SearchKnowledgeMapOutput = z.infer<typeof SearchKnowledgeMapOutputSchema>;

export async function searchKnowledgeMap(input: SearchKnowledgeMapInput): Promise<SearchKnowledgeMapOutput> {
  return searchKnowledgeMapFlow(input);
}

const prompt = ai.definePrompt({
  name: 'searchKnowledgeMapPrompt',
  input: {schema: SearchKnowledgeMapInputSchema},
  output: {schema: SearchKnowledgeMapOutputSchema},
  prompt: `You are an AI assistant specialized in searching and navigating knowledge maps.
You excel at understanding semantic relevance and conceptual connections.

A user has provided a search query and a list of nodes from their knowledge map.
Your task is to identify which of these nodes are most relevant to the user's query.
Consider the meaning of the query and the titles of the nodes.

Search Query: {{{searchQuery}}}

Available Nodes:
{{#if nodes.length}}
{{#each nodes}}
- ID: {{{this.id}}}, Title: {{{this.title}}}
{{/each}}
{{else}}
- No nodes provided.
{{/if}}

Based on your analysis, return a JSON object containing a single key "relevantNodeIds".
This key should hold an array of strings, where each string is the ID of a node you've identified as relevant.
If no nodes are particularly relevant, or if no nodes were provided, return an empty array for "relevantNodeIds".

Example output for relevant nodes:
{
  "relevantNodeIds": ["node-abc-123", "node-xyz-456"]
}

Example output if no relevant nodes are found:
{
  "relevantNodeIds": []
}
`,
});

const searchKnowledgeMapFlow = ai.defineFlow(
  {
    name: 'searchKnowledgeMapFlow',
    inputSchema: SearchKnowledgeMapInputSchema,
    outputSchema: SearchKnowledgeMapOutputSchema,
  },
  async input => {
    if (input.nodes.length === 0) {
      return { relevantNodeIds: [] };
    }
    const {output} = await prompt(input);
    return output!;
  }
);
