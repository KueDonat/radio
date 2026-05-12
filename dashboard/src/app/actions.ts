'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function addSong(formData: FormData) {
  const title = formData.get('title') as string
  const url = formData.get('url') as string
  const requestedBy = formData.get('requestedBy') as string

  if (!title || !url) return;

  await prisma.song.create({
    data: {
      title,
      url,
      requestedBy: requestedBy || 'Anonymous',
    }
  })

  revalidatePath('/')
}
