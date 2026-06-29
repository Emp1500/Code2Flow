export type Language = 'javascript' | 'typescript' | 'python'

export interface Profile {
  id: string
  username: string
  created_at: string
}

export interface Flowchart {
  id: string
  user_id: string
  title: string
  language: Language
  is_public: boolean
  share_id: string | null
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

export interface FlowchartVersion {
  id: string
  flowchart_id: string
  code: string
  version_number: number
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id'>>
        Relationships: []
      }
      flowcharts: {
        Row: Flowchart
        Insert: Omit<Flowchart, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Flowchart, 'id' | 'user_id' | 'created_at'>>
        Relationships: []
      }
      flowchart_versions: {
        Row: FlowchartVersion
        Insert: Omit<FlowchartVersion, 'id' | 'created_at'> & { id?: string }
        Update: Partial<Omit<FlowchartVersion, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
