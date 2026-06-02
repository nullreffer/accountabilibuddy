import { prisma } from './prisma';

export const postSystemMessage = async (groupId: string, text: string): Promise<void> => {
  await prisma.chatMessage.create({
    data: { groupId, type: 'system', text }
  });
};
