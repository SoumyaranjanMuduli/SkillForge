// Hand-written Supabase Database type definitions matching db/schema.sql + db/migrations/001_skillforge_hardening.sql
// Regenerate/adjust this file whenever the SQL schema changes.
// (Ideally generated via `supabase gen types typescript`, kept manual here since no live project is linked.)

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[] | Record<string, unknown>

export type UserRole = 'user' | 'admin'
export type QuestionTypeDb =
  | 'mcq'
  | 'multi_select'
  | 'true_false'
  | 'text'
  | 'numeric'
  | 'sql'
  | 'python'
  | 'excel'
  | 'code'
  | 'data_engineering'
  | 'case_study'
  | 'manual_review'
export type DifficultyDb = 'easy' | 'medium' | 'hard'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: UserRole
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          role?: UserRole
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: UserRole
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          id: string
          slug: string
          name: string
          description: string
          icon: string
          status: string
          created_at: string
        }
        Insert: {
          id: string
          slug: string
          name: string
          description?: string
          icon?: string
          status?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['programs']['Insert']>
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          program_id: string
          topic: string
          topic_id: string | null
          subtopic: string | null
          title: string
          prompt: string
          question_type: QuestionTypeDb
          difficulty: DifficultyDb
          marks: number
          time_limit_sec: number
          instructions: string
          dataset_id: string | null
          starter_code: string | null
          choices: Json | null
          tags: Json
          answer_key: string | null
          grading_mode: string
          grader_config: Json
          explanation: string | null
          status: string
          version: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          program_id: string
          topic: string
          topic_id?: string | null
          subtopic?: string | null
          title: string
          prompt: string
          question_type: QuestionTypeDb
          difficulty: DifficultyDb
          marks?: number
          time_limit_sec?: number
          instructions?: string
          dataset_id?: string | null
          starter_code?: string | null
          choices?: Json | null
          tags?: Json
          answer_key?: string | null
          grading_mode?: string
          grader_config?: Json
          explanation?: string | null
          status?: string
          version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['questions']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'questions_program_id_fkey'
            columns: ['program_id']
            isOneToOne: false
            referencedRelation: 'programs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'questions_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      assessments: {
        Row: {
          id: string
          name: string
          description: string
          program_id: string
          duration_sec: number
          passing_score: number
          max_attempts: number
          randomize_questions: boolean
          randomize_options: boolean
          start_date: string | null
          end_date: string | null
          published: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          description?: string
          program_id: string
          duration_sec: number
          passing_score?: number
          max_attempts?: number
          randomize_questions?: boolean
          randomize_options?: boolean
          start_date?: string | null
          end_date?: string | null
          published?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['assessments']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'assessments_program_id_fkey'
            columns: ['program_id']
            isOneToOne: false
            referencedRelation: 'programs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessments_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          question_id: string
          position: number
          marks_override: number | null
          time_limit_override_sec: number | null
        }
        Insert: {
          assessment_id: string
          question_id: string
          position: number
          marks_override?: number | null
          time_limit_override_sec?: number | null
        }
        Update: Partial<Database['public']['Tables']['assessment_questions']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'assessment_questions_assessment_id_fkey'
            columns: ['assessment_id']
            isOneToOne: false
            referencedRelation: 'assessments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_questions_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
        ]
      }
      assessment_assignments: {
        Row: {
          assessment_id: string
          user_id: string
          assigned_at: string
        }
        Insert: {
          assessment_id: string
          user_id: string
          assigned_at?: string
        }
        Update: Partial<Database['public']['Tables']['assessment_assignments']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'assessment_assignments_assessment_id_fkey'
            columns: ['assessment_id']
            isOneToOne: false
            referencedRelation: 'assessments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'assessment_assignments_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      attempts: {
        Row: {
          id: string
          assessment_id: string
          user_id: string
          started_at: string
          submitted_at: string | null
          duration_sec: number
          score: number
          max_score: number
          status: string
          question_order: Json
          last_activity_at: string
          result_released_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          user_id: string
          started_at?: string
          submitted_at?: string | null
          duration_sec?: number
          score?: number
          max_score?: number
          status?: string
          question_order?: Json
          last_activity_at?: string
          result_released_at?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['attempts']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'attempts_assessment_id_fkey'
            columns: ['assessment_id']
            isOneToOne: false
            referencedRelation: 'assessments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attempts_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      attempt_question_snapshots: {
        Row: {
          id: string
          attempt_id: string
          question_id: string
          question_version: number
          question_snapshot: Json
          answer_key_snapshot: string | null
          grader_config_snapshot: Json
          created_at: string
        }
        Insert: {
          id?: string
          attempt_id: string
          question_id: string
          question_version: number
          question_snapshot: Json
          answer_key_snapshot?: string | null
          grader_config_snapshot?: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['attempt_question_snapshots']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'attempt_question_snapshots_attempt_id_fkey'
            columns: ['attempt_id']
            isOneToOne: false
            referencedRelation: 'attempts'
            referencedColumns: ['id']
          },
        ]
      }
      attempt_answers: {
        Row: {
          id: string
          attempt_id: string
          question_id: string
          answer: string
          is_correct: boolean | null
          score: number
          time_spent_sec: number
          feedback: string | null
          admin_comment: string | null
          reviewed: boolean
          grading_status: 'pending' | 'running' | 'completed' | 'failed' | 'manual_review'
          requires_review: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          attempt_id: string
          question_id: string
          answer?: string
          is_correct?: boolean | null
          score?: number
          time_spent_sec?: number
          feedback?: string | null
          admin_comment?: string | null
          reviewed?: boolean
          grading_status?: 'pending' | 'running' | 'completed' | 'failed' | 'manual_review'
          requires_review?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['attempt_answers']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'attempt_answers_attempt_id_fkey'
            columns: ['attempt_id']
            isOneToOne: false
            referencedRelation: 'attempts'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          id: number
          actor_id: string | null
          action: string
          entity: string
          entity_id: string | null
          old_value: Json | null
          new_value: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          actor_id?: string | null
          action: string
          entity: string
          entity_id?: string | null
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      activity_logs: {
        Row: {
          id: number
          user_id: string | null
          attempt_id: string | null
          action: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          attempt_id?: string | null
          action: string
          metadata?: Json
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['activity_logs']['Insert']>
        Relationships: []
      }
      question_versions: {
        Row: {
          id: number
          question_id: string
          version: number
          snapshot: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: number
          question_id: string
          version: number
          snapshot: Json
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['question_versions']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'question_versions_question_id_fkey'
            columns: ['question_id']
            isOneToOne: false
            referencedRelation: 'questions'
            referencedColumns: ['id']
          },
        ]
      }
      question_import_batches: {
        Row: {
          id: string
          filename: string
          uploaded_by: string
          row_count: number
          valid_count: number
          error_count: number
          target_status: string
          status: string
          question_ids: string[]
          created_at: string
          committed_at: string | null
        }
        Insert: {
          id?: string
          filename: string
          uploaded_by: string
          row_count?: number
          valid_count?: number
          error_count?: number
          target_status?: string
          status?: string
          question_ids?: string[]
          created_at?: string
          committed_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['question_import_batches']['Insert']>
        Relationships: []
      }
      topics: {
        Row: {
          id: string
          program_id: string
          parent_id: string | null
          name: string
          slug: string
          description: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          program_id: string
          parent_id?: string | null
          name: string
          slug: string
          description?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['topics']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'topics_program_id_fkey'
            columns: ['program_id']
            isOneToOne: false
            referencedRelation: 'programs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topics_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      start_attempt_atomic: {
        Args: { p_assessment_id: string; p_user_id: string; p_question_order: Json; p_max_score: number }
        Returns: { attempt_id: string; started_at: string; resumed: boolean }[]
      }
      save_assessment_atomic: {
        Args: { p_assessment: Json; p_questions: Json; p_actor: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: UserRole
      question_type: QuestionTypeDb
      difficulty: DifficultyDb
    }
    CompositeTypes: Record<string, never>
  }
}
