import { supabase } from '@/integrations/supabase/client';
import { showError } from './toast';

/**
 * Consome um crédito de reposição de um aluno.
 * @param studentId ID do aluno.
 */
export const consumeRepositionCredit = async (studentId: string) => {
  try {
    // Busca o saldo atual para validação (simples, mas necessário)
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('reposition_credits')
      .eq('id', studentId)
      .single();

    if (fetchError) throw fetchError;
    if ((student?.reposition_credits ?? 0) <= 0) {
      throw new Error('Saldo de créditos insuficiente para reposição.');
    }

    // Chama a RPC para decrementar o crédito
    const { error: rpcError } = await supabase.rpc('increment_reposition_credit', {
      p_student_id: studentId,
      p_amount: -1,
    });

    if (rpcError) throw rpcError;
    return true;
  } catch (error: any) {
    showError(error.message);
    throw error;
  }
};

/**
 * Devolve um crédito de reposição a um aluno.
 * @param studentId ID do aluno.
 */
export const returnRepositionCredit = async (studentId: string) => {
  try {
    // Chama a RPC para incrementar o crédito
    const { error: rpcError } = await supabase.rpc('increment_reposition_credit', {
      p_student_id: studentId,
      p_amount: 1,
    });

    if (rpcError) throw rpcError;
    return true;
  } catch (error: any) {
    showError(`Falha ao devolver crédito: ${error.message}`);
    throw error;
  }
};