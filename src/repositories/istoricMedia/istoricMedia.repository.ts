import { db } from "../../db/pool"
export type MediaType = 'image' | 'video' | 'document'

export interface IstoricMedia {
  zkIstoricMediaP: string
  mediaName: string
  mediaURL: string
  mediaType: MediaType
  dataDocument: Date
  notite: string | null
  createdAccount: string
  createdTimestamp: Date
  modificationAccount: string | null
  modificationTimestamp: Date | null
  // TODO: uncomment when modules are implemented
  // zkIDModulF: string | null
  // TODO: uncomment when operations are implemented
  // zkOperatieIDF: string | null
  zkIDPacientF: string
}

export interface CreateMediaInput {
  mediaName: string
  mediaURL: string
  mediaType: MediaType
  dataDocument: Date | string
  notite?: string | null
  createdAccount: string
  zkIDPacientF: string
  // TODO: make required when modules are implemented
  zkIDModulF?: string | null
  // TODO: make required when operations are implemented
  zkOperatieIDF?: string | null
}

export interface UpdateMediaInput {
  mediaName?: string
  mediaURL?: string
  mediaType?: MediaType
  dataDocument?: Date | string
  notite?: string | null
  modificationAccount: string
}

function rowToMedia(row: Record<string, unknown>): IstoricMedia {
  return {
    zkIstoricMediaP: row.zk_istoricmedia_p as string,
    mediaName: row.medianame as string,
    mediaURL: row.mediaurl as string,
    mediaType: row.mediatype as MediaType,
    dataDocument: row.datadocument as Date,
    notite: (row.notite as string | null) ?? null,
    createdAccount: row.createdaccount as string,
    createdTimestamp: row.createdtimestamp as Date,
    modificationAccount: (row.modificationaccount as string | null) ?? null,
    modificationTimestamp: (row.modificationtimestamp as Date | null) ?? null,
    zkIDPacientF: row.zk_idpacient_f as string,
    // TODO: uncomment when modules are implemented
    // zkIDModulF:        (row.zk_idmodul_f as string | null) ?? null,
    // TODO: uncomment when operations are implemented
    // zkOperatieIDF:     (row.zk_operatieid_f as string | null) ?? null,
  }
}

export const mediaRepository = {
  async findByPatient(
    patientId: string,
    mediaType?: MediaType
  ): Promise<IstoricMedia[]> {
    if (mediaType) {
      const result = await db.query(
        `SELECT * FROM IstoricMedia
         WHERE zk_idpacient_f = $1 AND media_type = $2
         ORDER BY datadocument DESC, zk_istoricmedia_p ASC`,
        [patientId, mediaType]
      )
      return result.rows.map(rowToMedia)
    }

    const result = await db.query(
      `SELECT * FROM IstoricMedia
       WHERE zk_idpacient_f = $1
       ORDER BY datadocument DESC, zk_istoricmedia_p ASC`,
      [patientId]
    )
    return result.rows.map(rowToMedia)
  },

  async findById(id: string): Promise<IstoricMedia | null> {
    const result = await db.query(
      'SELECT * FROM IstoricMedia WHERE zk_istoricmedia_p = $1',
      [id]
    )
    return result.rows[0] ? rowToMedia(result.rows[0]) : null
  },

  async create(data: CreateMediaInput): Promise<IstoricMedia> {
    const result = await db.query(
      `INSERT INTO IstoricMedia (
          medianame,
          mediaurl,
          mediatype,
          datadocument,
          notite,
          createdaccount,
          createdtimestamp,
          zk_idpacient_f,
          zk_idmodul_f,
          zk_operatieid_f
        ) VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9)
        RETURNING *`,
      [
        data.mediaName,
        data.mediaURL,
        data.mediaType,
        data.dataDocument,
        data.notite ?? null,
        data.createdAccount,
        data.zkIDPacientF,
        data.zkIDModulF ?? null,    // TODO: remove null fallback when modules are required
        data.zkOperatieIDF ?? null, // TODO: remove null fallback when operations are required
      ]
    )
    return rowToMedia(result.rows[0])
  },

  async update(id: string, data: UpdateMediaInput): Promise<IstoricMedia | null> {
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    const fieldMap: Record<string, string> = {
      mediaName: 'medianame',
      mediaURL: 'mediaurl',
      mediaType: 'mediatype',
      dataDocument: 'datadocument',
      notite: 'notite',
      modificationAccount: 'modificationaccount',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in data) {
        fields.push(`${col} = $${i++}`)
        values.push((data as unknown as Record<string, unknown>)[key])
      }
    }

    if (fields.length === 0) return this.findById(id)

    // Always stamp modification timestamp when anything changes
    fields.push(`modificationtimestamp = NOW()`)

    values.push(id)
    const result = await db.query(
      `UPDATE IstoricMedia
       SET ${fields.join(', ')}
       WHERE zk_istoricmedia_p = $${i}
       RETURNING *`,
      values
    )
    return result.rows[0] ? rowToMedia(result.rows[0]) : null
  },

  async delete(id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM IstoricMedia WHERE zk_istoricmedia_p = $1',
      [id]
    )
    return (result.rowCount ?? 0) > 0
  },
}