import { Client } from '@microsoft/microsoft-graph-client'
import { ConfidentialClientApplication } from '@azure/msal-node'
import 'isomorphic-fetch'

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
}

const cca = new ConfidentialClientApplication(msalConfig)

async function getAccessToken() {
  try {
    const result = await cca.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    })
    return result?.accessToken
  } catch (error) {
    console.error('Error acquiring token:', error)
    throw error
  }
}

export async function getGraphClient() {
  const token = await getAccessToken()

  return Client.init({
    authProvider: (done) => {
      done(null, token!)
    },
  })
}

export async function getEmailsFromSender(senderEmail: string, subject?: string) {
  const client = await getGraphClient()

  const userEmail = process.env.USER_EMAIL || 'hayden@laserbeamcapital.com'

  try {
    // Fetch recent messages without complex filters to avoid InefficientFilter error
    const messages = await client
      .api(`/users/${userEmail}/messages`)
      .top(100)
      .select('id,subject,receivedDateTime,hasAttachments,from')
      .get()

    // Filter messages in code
    let filteredMessages = messages.value.filter((msg: any) => {
      const fromAddress = msg.from?.emailAddress?.address?.toLowerCase()
      return fromAddress === senderEmail.toLowerCase()
    })

    // Apply subject filter if provided
    if (subject) {
      filteredMessages = filteredMessages.filter((msg: any) =>
        msg.subject?.toLowerCase().includes(subject.toLowerCase())
      )
    }

    // Sort by date (most recent first)
    filteredMessages.sort((a: any, b: any) => {
      return new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime()
    })

    return filteredMessages
  } catch (error) {
    console.error('Error fetching emails:', error)
    throw error
  }
}

export async function getEmailAttachments(messageId: string) {
  const client = await getGraphClient()

  const userEmail = process.env.USER_EMAIL || 'hayden@laserbeamcapital.com'

  try {
    const attachments = await client
      .api(`/users/${userEmail}/messages/${messageId}/attachments`)
      .get()

    return attachments.value
  } catch (error) {
    console.error('Error fetching attachments:', error)
    throw error
  }
}

export async function getLatestEmailWithAttachment(
  senderEmail: string,
  fileNamePattern: string
) {
  const emails = await getEmailsFromSender(senderEmail)

  for (const email of emails) {
    if (email.hasAttachments) {
      const attachments = await getEmailAttachments(email.id)

      const matchingAttachment = attachments.find((att: any) =>
        att.name.includes(fileNamePattern)
      )

      if (matchingAttachment) {
        return {
          email,
          attachment: matchingAttachment,
        }
      }
    }
  }

  return null
}
