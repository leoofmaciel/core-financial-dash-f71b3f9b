export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
          workspace_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          description: string
          id: string
          position: number
          quantity: number
          total: number
          unit_price: number
          workspace_id: string
        }
        Insert: {
          budget_id: string
          description: string
          id?: string
          position?: number
          quantity?: number
          total?: number
          unit_price?: number
          workspace_id?: string
        }
        Update: {
          budget_id?: string
          description?: string
          id?: string
          position?: number
          quantity?: number
          total?: number
          unit_price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          client_company: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          delivery_time: string | null
          id: string
          notes: string | null
          number: number
          order_id: string | null
          payment_terms: string | null
          total: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          client_company?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          delivery_time?: string | null
          id?: string
          notes?: string | null
          number?: number
          order_id?: string | null
          payment_terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          client_company?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          delivery_time?: string | null
          id?: string
          notes?: string | null
          number?: number
          order_id?: string | null
          payment_terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          cnpj: string | null
          codigo_municipio_ibge: string | null
          company: string | null
          contact_name: string | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_municipio: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: string | null
          company?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_municipio?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: string | null
          company?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_municipio?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          access_key: string | null
          client_id: string | null
          created_at: string
          id: string
          notaas_id: string | null
          number: string | null
          order_id: string | null
          payload: Json | null
          pdf_url: string | null
          return_message: string | null
          series: string | null
          status: string
          total_amount: number
          type: string
          updated_at: string
          user_id: string
          workspace_id: string
          xml_url: string | null
        }
        Insert: {
          access_key?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          notaas_id?: string | null
          number?: string | null
          order_id?: string | null
          payload?: Json | null
          pdf_url?: string | null
          return_message?: string | null
          series?: string | null
          status?: string
          total_amount?: number
          type: string
          updated_at?: string
          user_id: string
          workspace_id?: string
          xml_url?: string | null
        }
        Update: {
          access_key?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          notaas_id?: string | null
          number?: string | null
          order_id?: string | null
          payload?: Json | null
          pdf_url?: string | null
          return_message?: string | null
          series?: string | null
          status?: string
          total_amount?: number
          type?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          aliquota_iss: number | null
          ambiente: string | null
          certificado_nome: string | null
          certificado_notaas_id: string | null
          certificado_path: string | null
          certificado_senha: string | null
          certificado_uploaded_at: string | null
          certificado_validade: string | null
          cfop_padrao: string | null
          cnae: string | null
          cnpj_emissor: string | null
          codigo_municipio: string | null
          codigo_tributacao_municipio: string | null
          created_at: string
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_municipio: string | null
          endereco_numero: string | null
          id: string
          incentivador_cultural: boolean | null
          inscricao_municipal: string | null
          iss_retido: boolean | null
          item_lista_servico: string | null
          natureza_operacao: string | null
          ncm_padrao: string | null
          optante_simples_nacional: boolean | null
          proximo_numero_rps: number | null
          razao_social: string | null
          regime_especial_tributacao: string | null
          regime_tributario: string | null
          serie_rps: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
          user_id: string
          webhook_secret: string | null
          workspace_id: string
        }
        Insert: {
          aliquota_iss?: number | null
          ambiente?: string | null
          certificado_nome?: string | null
          certificado_notaas_id?: string | null
          certificado_path?: string | null
          certificado_senha?: string | null
          certificado_uploaded_at?: string | null
          certificado_validade?: string | null
          cfop_padrao?: string | null
          cnae?: string | null
          cnpj_emissor?: string | null
          codigo_municipio?: string | null
          codigo_tributacao_municipio?: string | null
          created_at?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_municipio?: string | null
          endereco_numero?: string | null
          id?: string
          incentivador_cultural?: boolean | null
          inscricao_municipal?: string | null
          iss_retido?: boolean | null
          item_lista_servico?: string | null
          natureza_operacao?: string | null
          ncm_padrao?: string | null
          optante_simples_nacional?: boolean | null
          proximo_numero_rps?: number | null
          razao_social?: string | null
          regime_especial_tributacao?: string | null
          regime_tributario?: string | null
          serie_rps?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
          workspace_id?: string
        }
        Update: {
          aliquota_iss?: number | null
          ambiente?: string | null
          certificado_nome?: string | null
          certificado_notaas_id?: string | null
          certificado_path?: string | null
          certificado_senha?: string | null
          certificado_uploaded_at?: string | null
          certificado_validade?: string | null
          cfop_padrao?: string | null
          cnae?: string | null
          cnpj_emissor?: string | null
          codigo_municipio?: string | null
          codigo_tributacao_municipio?: string | null
          created_at?: string
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_municipio?: string | null
          endereco_numero?: string | null
          id?: string
          incentivador_cultural?: boolean | null
          inscricao_municipal?: string | null
          iss_retido?: boolean | null
          item_lista_servico?: string | null
          natureza_operacao?: string | null
          ncm_padrao?: string | null
          optante_simples_nacional?: boolean | null
          proximo_numero_rps?: number | null
          razao_social?: string | null
          regime_especial_tributacao?: string | null
          regime_tributario?: string | null
          serie_rps?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_payments: {
        Row: {
          amount: number
          id: string
          investment_id: string
          partner_id: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          id?: string
          investment_id: string
          partner_id: string
          workspace_id?: string
        }
        Update: {
          amount?: number
          id?: string
          investment_id?: string
          partner_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_payments_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_payments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          notes: string | null
          position: number
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          position?: number
          status?: string
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          position?: number
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          kind: string
          subject: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          id?: string
          kind: string
          subject?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          kind?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          id: string
          member_id: string
          module: Database["public"]["Enums"]["module_key"]
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          member_id: string
          module: Database["public"]["Enums"]["module_key"]
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          id?: string
          member_id?: string
          module?: Database["public"]["Enums"]["module_key"]
        }
        Relationships: [
          {
            foreignKeyName: "module_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          created_at: string
          file_path: string
          file_url: string | null
          id: string
          mime: string | null
          name: string
          order_id: string
          size: number | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_url?: string | null
          id?: string
          mime?: string | null
          name: string
          order_id: string
          size?: number | null
          user_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_url?: string | null
          id?: string
          mime?: string | null
          name?: string
          order_id?: string
          size?: number | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      order_communications: {
        Row: {
          body: string | null
          channel: string
          id: string
          order_id: string
          pdf_url: string | null
          recipient: string | null
          sent_at: string
          status: string
          subject: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          channel: string
          id?: string
          order_id: string
          pdf_url?: string | null
          recipient?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          user_id: string
          workspace_id?: string
        }
        Update: {
          body?: string | null
          channel?: string
          id?: string
          order_id?: string
          pdf_url?: string | null
          recipient?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_communications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          description: string
          id: string
          order_id: string
          position: number
          quantity: number
          total: number
          unit_price: number
          workspace_id: string
        }
        Insert: {
          description: string
          id?: string
          order_id: string
          position?: number
          quantity?: number
          total?: number
          unit_price?: number
          workspace_id?: string
        }
        Update: {
          description?: string
          id?: string
          order_id?: string
          position?: number
          quantity?: number
          total?: number
          unit_price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      order_materials: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          id: string
          order_id: string
          quantity: number
          supplier_name: string | null
          total: number
          transaction_id: string | null
          unit_price: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          order_id: string
          quantity?: number
          supplier_name?: string | null
          total?: number
          transaction_id?: string | null
          unit_price?: number
          workspace_id?: string
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          order_id?: string
          quantity?: number
          supplier_name?: string | null
          total?: number
          transaction_id?: string | null
          unit_price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_materials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_materials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approved_at: string | null
          client_id: string | null
          created_at: string
          delivery_time: string | null
          id: string
          notes: string | null
          number: number
          payment_terms: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          client_id?: string | null
          created_at?: string
          delivery_time?: string | null
          id?: string
          notes?: string | null
          number?: number
          payment_terms?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          approved_at?: string | null
          client_id?: string | null
          created_at?: string
          delivery_time?: string | null
          id?: string
          notes?: string | null
          number?: number
          payment_terms?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          share_percent: number
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          share_percent?: number
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          share_percent?: number
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurrences: {
        Row: {
          active: boolean
          amount: number
          category_id: string | null
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          frequency: string
          id: string
          last_generated_at: string | null
          name: string
          next_run: string
          payment_method: string | null
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          amount: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          frequency?: string
          id?: string
          last_generated_at?: string | null
          name: string
          next_run: string
          payment_method?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category_id?: string | null
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          frequency?: string
          id?: string
          last_generated_at?: string | null
          name?: string
          next_run?: string
          payment_method?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          done: boolean
          id: string
          notes: string | null
          position: number
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          notes?: string | null
          position?: number
          title: string
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          notes?: string | null
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          attachment_url: string | null
          category_id: string | null
          code: number
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          name: string
          notes: string | null
          order_id: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["tx_status"]
          transaction_date: string
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount: number
          attachment_url?: string | null
          category_id?: string | null
          code?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          transaction_date?: string
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id: string
          workspace_id?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          category_id?: string | null
          code?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          transaction_date?: string
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit: {
        Args: { _module: Database["public"]["Enums"]["module_key"] }
        Returns: boolean
      }
      can_view: {
        Args: { _module: Database["public"]["Enums"]["module_key"] }
        Returns: boolean
      }
      current_workspace_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      module_key:
        | "dashboard"
        | "clients"
        | "orders"
        | "budgets"
        | "transactions"
        | "categories"
        | "recurrences"
        | "investments"
        | "partners"
        | "tasks"
        | "fiscal"
        | "reports"
        | "settings"
        | "users"
      order_status:
        | "rascunho"
        | "orcamento"
        | "aprovado"
        | "cancelado"
        | "orcamento_enviado"
        | "visualizado"
        | "aguardando_retorno"
        | "enviado"
        | "faturado"
      tx_status: "pago" | "pendente" | "atrasado"
      tx_type: "entrada" | "saida"
      workspace_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      module_key: [
        "dashboard",
        "clients",
        "orders",
        "budgets",
        "transactions",
        "categories",
        "recurrences",
        "investments",
        "partners",
        "tasks",
        "fiscal",
        "reports",
        "settings",
        "users",
      ],
      order_status: [
        "rascunho",
        "orcamento",
        "aprovado",
        "cancelado",
        "orcamento_enviado",
        "visualizado",
        "aguardando_retorno",
        "enviado",
        "faturado",
      ],
      tx_status: ["pago", "pendente", "atrasado"],
      tx_type: ["entrada", "saida"],
      workspace_role: ["owner", "admin", "member"],
    },
  },
} as const
