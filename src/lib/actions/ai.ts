'use server';

export async function chatWithAI(message: string, history: { role: string, content: string }[] = []) {
  try {
    // Kept in the public signature for clients that already send conversation
    // context; the current deterministic fallback does not consume it.
    void history;
    // In a real app, you'd call OpenAI/Anthropic/Gemini here.
    // For now, let's simulate a helpful multilingual assistant.
    // We can use the user's current session to personalize.

    // Simulate an AI response delay
    await new Promise(r => setTimeout(r, 1000));

    // Simple heuristic for demo purposes
    let response = "I'm here to help you with Zenqar. How can I assist you with your invoices or settings today?";
    
    if (message.toLowerCase().includes('invoice') || message.includes('فاتورة') || message.includes('فاکتور')) {
      response = "You can create and manage invoices in the Invoices section. Remember to 'Issue' a draft invoice to send it to your customer.";
    } else if (message.toLowerCase().includes('iqd') || message.includes('دينار') || message.includes('دینار')) {
      response = "Zenqar automatically fetches market USD/IQD rates and adds a 10% street markup to ensure your prices reflect reality.";
    } else if (message.toLowerCase().includes('hi') || message.toLowerCase().includes('hello') || message.includes('مرحبا') || message.includes('سڵاو')) {
      response = "Hello! I am your Zenqar AI assistant. I can help you in English, Arabic, Kurdish, or Estonian. How can I help?";
    }

    return { response };
  } catch (err) {
    console.error('[AI] Chat error:', err);
    return { error: 'Failed to connect to AI assistant' };
  }
}
