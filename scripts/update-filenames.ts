/**
 * One-time migration: updates the filename column in Supabase to match
 * the renamed files on disk.
 *
 * Usage:  npx tsx scripts/update-filenames.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const RENAMES: [string, string][] = [
  ['trust-deed-namibian-family-trust.txt',  'trust-deed-steenkamp.txt'],
  ['notulen-van-der-berg-holdings.txt',     'EP-BM-2023-022.txt'],
  ['due-diligence-cape-vineyards.txt',      'EP-DD-2024-003.txt'],
  ['compliance-memo-crs-south-africa.txt',  'EP-CM-2024-007.txt'],
  ['structuuradvies-nl-za-holding.txt',     'EP-SA-2023-010.txt'],
  ['service-level-agreement-edgepoint.txt', 'service-level-agreement.txt'],
  ['memo-ubo-register-update-2024.txt',     'EP-RM-2024-006.txt'],
  ['trust-amendment-beneficiary.txt',       'EP-TA-2023-012.txt'],
  ['tax-opinion-dividend-withholding.txt',  'EP-TO-2023-019.txt'],
  ['board-resolution-director-appointment.txt', 'board-resolution-vdb-2024.txt'],
  ['compliance-checklist-aml-kyc.txt',      'compliance-checklist-aml.txt'],
  ['memo-namibian-companies-act-2024.txt',  'EP-RM-2024-008.txt'],
]

async function main() {
  console.log('Updating filenames in Supabase...\n')
  let updated = 0

  for (const [oldName, newName] of RENAMES) {
    const { error, count } = await supabase
      .from('documents')
      .update({ filename: newName })
      .eq('filename', oldName)

    if (error) {
      console.log(`  [error] ${oldName} → ${newName}: ${error.message}`)
    } else {
      console.log(`  [ok]    ${oldName} → ${newName}`)
      updated++
    }
  }

  console.log(`\nDone. ${updated}/${RENAMES.length} records updated.`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
