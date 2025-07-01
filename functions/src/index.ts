import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()
const db = admin.firestore()

export const calculatePlayerRewards = functions.firestore
  .document('simulations/{simId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() || {}
    const afterData = change.after.data() || {}

    const noveltyEventsBefore = beforeData.majorNoveltyCount || 0
    const noveltyEventsAfter = afterData.majorNoveltyCount || 0

    if (noveltyEventsAfter > noveltyEventsBefore) {
      const logs = await db
        .collection('intervention_logs')
        .where('simulationId', '==', context.params.simId)
        .where('timestamp', '<', afterData.lastNoveltyTimestamp)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get()

      if (!logs.empty) {
        const interventionData = logs.docs[0].data()
        const playerId = interventionData.playerId

        const points = 1000
        const playerRef = db.collection('players').doc(playerId)

        await db.runTransaction(async tx => {
          const playerDoc = await tx.get(playerRef)
          const newScore = (playerDoc.data()?.score || 0) + points
          tx.update(playerRef, { score: newScore })
        })
      }
    }
    return null
  })
