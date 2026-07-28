import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export async function fetchData() {
  const { data, error } = await supabase.from('table').select('*');
  if (error) throw error;
  return data;
}

export async function searchProfessionals({ category, keywords, isEmergency }) {
  if (!category) return [];

  try {
    let query = supabase
      .from('professional_profiles')
      .select('id, trade_name, specialty, specialty_category, skills, description, location_city, location_province, emergency_available, whatsapp_phone, hourly_rate')
      .eq('is_active', true);

    // Buscar por specialty_category o specialty que matchee
    // Usamos OR para ser más flexibles
    const categoryLower = category.toLowerCase();

    const { data, error } = await query
      .or(
        `specialty_category.ilike.%${categoryLower}%,` +
        `specialty.ilike.%${categoryLower}%,` +
        `description.ilike.%${categoryLower}%`
      )
      .order('emergency_available', { ascending: false }) // primero emergencias si aplica
      .limit(10);

    if (error) {
      console.error('Error Supabase:', error);
      return [];
    }

    // Si no hay resultados con la categoría principal, buscar por keywords
    if (data.length === 0 && keywords && keywords.length > 0) {
      return await searchByKeywords(keywords, isEmergency);
    }

    return data || [];
  } catch (err) {
    console.error('Error en searchProfessionals:', err);
    return [];
  }
}

async function searchByKeywords(keywords) {
  try {
    // Buscar con el primer keyword como fallback
    const keyword = keywords[0];

    let query = supabase
      .from('professional_profiles')
      .select('id, trade_name, specialty, specialty_category, skills, description, location_city, location_province, emergency_available, whatsapp_phone, hourly_rate')
      .eq('is_active', true);

    const { data, error } = await query
      .or(`specialty.ilike.%${keyword}%,description.ilike.%${keyword}%,skills.cs.{${keyword}}`)
      .limit(5);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
