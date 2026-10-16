import React, { useState } from 'react';
import { Order, Customer } from '../../types';
import { MessageSquare, Mail, X, Send, CheckCircle2 } from 'lucide-react';
import { storageService } from '../../services/storageService';

interface NotificationModalProps {
  order: Order;
  customer?: Customer;
  isOpen: boolean;
  onClose: () => void;
  triggerType?: 'new_order' | 'status_update';
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  order,
  customer,
  isOpen,
  onClose,
  triggerType = 'status_update',
}) => {
  const [sendWhatsapp, setSendWhatsapp] = useState<boolean>(true);
  const [sendEmail, setSendEmail] = useState<boolean>(!!order.customerEmail);
  const [sentStatus, setSentStatus] = useState<string | null>(null);

  const customerName = customer?.businessName || order.customerName;
  const phone = customer?.whatsapp || customer?.phone || order.customerWhatsapp || order.customerPhone;
  const email = customer?.email || order.customerEmail;

  // Render Template
  const generateMessage = () => {
    if (triggerType === 'new_order') {
      return `Hello ${customerName},\n\nYour print order has been received!\nJob Number: ${order.orderNumber}\nStatus: ${order.status}\nTotal: ${storageService.formatCurrency(order.totalAmount)}\nDue Date: ${order.dueDate}\n\nThank you for your business!`;
    }
    return `Hello ${customerName},\n\nUpdate for Order ${order.orderNumber}:\nStatus: ${order.status}\nTotal: ${storageService.formatCurrency(order.totalAmount)}\n\nThank you!`;
  };

  const [messageText, setMessageText] = useState<string>(generateMessage());

  if (!isOpen) return null;

  const handleSendWhatsapp = () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(messageText);
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;
    
    window.open(waUrl, '_blank');
    setSentStatus('WhatsApp message window opened!');
    setTimeout(() => setSentStatus(null), 3000);
  };

  const handleSendEmail = () => {
    if (!email) {
      alert('No email address found for this customer.');
      return;
    }
    const subject = encodeURIComponent(`Order Update - ${order.orderNumber}`);
    const body = encodeURIComponent(messageText);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_self');
    setSentStatus('Email client launched!');
    setTimeout(() => setSentStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg leading-tight">Send Update to Customer?</h3>
              <p className="text-xs text-slate-400">Job Number{order.orderNumber} • {customerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {sentStatus && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{sentStatus}</span>
            </div>
          )}

          {/* Delivery Options */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Notification Channels
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  sendWhatsapp
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendWhatsapp}
                  onChange={(e) => setSendWhatsapp(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span className="text-sm">WhatsApp</span>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  sendEmail
                    ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900 font-semibold'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <Mail className="w-4 h-4 text-indigo-600" />
                <span className="text-sm">Email</span>
              </label>
            </div>
          </div>

          {/* Message Preview / Edit */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Message Preview
              </label>
              <span className="text-xs text-slate-400">Editable before sending</span>
            </div>
            <textarea
              rows={5}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          {/* Recipient Details */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 text-slate-600">
            <p><span className="font-semibold text-slate-700">WhatsApp / Phone:</span> {phone || 'Not provided'}</p>
            <p><span className="font-semibold text-slate-700">Email Address:</span> {email || 'Not provided'}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Skip / Close
          </button>

          <div className="flex items-center gap-2">
            {sendWhatsapp && (
              <button
                onClick={handleSendWhatsapp}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Send WhatsApp</span>
              </button>
            )}

            {sendEmail && (
              <button
                onClick={handleSendEmail}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
              >
                <Mail className="w-4 h-4" />
                <span>Send Email</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
