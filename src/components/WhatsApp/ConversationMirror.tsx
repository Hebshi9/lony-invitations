import React from 'react';
import { X, User, CheckCheck } from 'lucide-react';

interface Message {
  id: string;
  message_text: string;
  image_url?: string;
  delivery_status: string;
  created_at: string;
  reply_type?: string;
}

interface ConversationMirrorProps {
  guest: any;
  messages: Message[];
  onClose: () => void;
}

const ConversationMirror: React.FC<ConversationMirrorProps> = ({ guest, messages, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#f0f2f5] w-full max-w-md h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#008069] p-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/10">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{guest.name}</h3>
              <p className="text-[10px] opacity-80" dir="ltr">{guest.phone}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="bg-white/80 backdrop-blur p-4 rounded-2xl text-slate-400 text-xs font-bold shadow-sm border border-slate-100">
                لا توجد محادثة مسجلة بعد
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isOutgoing = !msg.reply_type;
              return (
                <div 
                  key={msg.id} 
                  className={`flex ${isOutgoing ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[85%] rounded-xl p-2 shadow-sm relative ${
                    isOutgoing ? 'bg-white text-slate-800' : 'bg-[#d9fdd3] text-slate-800'
                  }`}>
                    {msg.image_url && (
                      <img 
                        src={msg.image_url} 
                        alt="Media" 
                        className="rounded-lg mb-2 w-full object-cover max-h-48 border border-slate-100"
                      />
                    )}
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.message_text}</p>
                    
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[8px] opacity-50">
                        {new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOutgoing && (
                        <CheckCheck className={`w-3 h-3 ${
                          msg.delivery_status === 'read' ? 'text-sky-400' : 'text-slate-300'
                        }`} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer (Mock Input) */}
        <div className="bg-[#f0f2f5] p-3 border-t border-slate-200">
          <div className="bg-white rounded-full p-2 px-4 text-xs text-slate-400 font-bold border border-slate-200 shadow-sm">
            نظام تتبع المحاكاة - لوني برو 🚀
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationMirror;
