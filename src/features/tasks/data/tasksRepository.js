// admin-panel/src/features/tasks/data/tasksRepository.js
import { supabase } from '../../../core/config/supabase';

export const tasksRepository = {
  async fetchAll({ status = null } = {}) {
    let query = supabase
      .from('tasks')
      .select(
        'id, title, description, status, due_date, due_time, assigned_to, assignees, attachments, comments, people, created_at, completed_at'
      )
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async createTask({ title, description, status, dueDate, dueTime, assignedTo }) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description,
        status,
        due_date: dueDate || null,
        due_time: dueTime || null,
        assigned_to: assignedTo,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateTaskStatus(id, status) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  },
};