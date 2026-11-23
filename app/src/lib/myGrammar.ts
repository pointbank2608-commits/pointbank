import type { GrammarBoardContent } from './grammar';
import type { GrammarSlide } from './types';
import { supabase } from './supabase';

export type GrammarPreset = Omit<GrammarSlide, 'id' | 'kind' | 'content'> & { content: GrammarBoardContent };
export interface SavedGrammar { id: string; revision: number; block: GrammarPreset }

export async function listMyGrammar(academy: string, owner: string): Promise<SavedGrammar[]> {
  const { data, error } = await supabase.from('teacher_grammar_blocks').select('id,revision,block')
    .eq('academy_id', academy).eq('owner_id', owner).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveMyGrammar(academy: string, owner: string, block: GrammarPreset, previous?: SavedGrammar) {
  const table = supabase.from('teacher_grammar_blocks');
  const query = previous
    ? table.update({ block, revision: previous.revision + 1 }).eq('id', previous.id).eq('revision', previous.revision)
        .eq('owner_id', owner).eq('academy_id', academy)
    : table.insert({ academy_id: academy, owner_id: owner, block });
  const { error } = await query.select('id').single();
  if (error) throw error;
}
