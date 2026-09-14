'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Trash2,
  Eye,
  Check,
  Calendar,
  X,
  CreditCard,
  Phone,
  MapPin,
  RefreshCw,
  ShoppingBag,
  FileSpreadsheet,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: { name: string };
  isAvailable: boolean;
}

interface OrderItemInput {
  menuItemId: string;
  itemName: string;
  categoryName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

interface OrderItemRecord {
  id: string;
  itemName: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderRecord {
  id: string;
  orderNumber: string;
  orderDate: string;
  orderTime: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  items: OrderItemRecord[];
}

export default function AdminDailyOrdersPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Order Form State
  const [orderCart, setOrderCart] = useState<OrderItemInput[]>([]);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [formError, setFormError] = useState('');

  // Modals State
  const [viewingOrder, setViewingOrder] = useState<OrderRecord | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [menuRes, ordersRes] = await Promise.all([
        fetch('/api/menu?availableOnly=true'),
        fetch('/api/orders?date=' + getTodayDateString()),
      ]);

      if (menuRes.ok) {
        const mItems = await menuRes.json();
        setMenuItems(mItems);
        if (mItems.length > 0) {
          setSelectedMenuItemId(mItems[0].id);
        }
      }

      if (ordersRes.ok) {
        setOrders(await ordersRes.json());
      }
    } catch (err) {
      console.error('Failed to load order data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFormattedDateDisplay = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return new Date().toLocaleDateString(undefined, options);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Add Item to Order Cart
  const handleAddItemToCart = () => {
    if (!selectedMenuItemId) return;

    const menuItem = menuItems.find((m) => m.id === selectedMenuItemId);
    if (!menuItem) return;

    const existingIndex = orderCart.findIndex(
      (ci) => ci.menuItemId === menuItem.id
    );

    if (existingIndex >= 0) {
      const updated = [...orderCart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].subtotal =
        updated[existingIndex].quantity * updated[existingIndex].unitPrice;
      setOrderCart(updated);
    } else {
      setOrderCart([
        ...orderCart,
        {
          menuItemId: menuItem.id,
          itemName: menuItem.name,
          categoryName: menuItem.category?.name || 'General',
          unitPrice: menuItem.price,
          quantity: 1,
          subtotal: menuItem.price,
        },
      ]);
    }
  };

  // Update Cart Item Quantity
  const handleUpdateQuantity = (index: number, delta: number) => {
    const updated = [...orderCart];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
      updated[index].subtotal = newQty * updated[index].unitPrice;
    }
    setOrderCart(updated);
  };

  // Remove Cart Item
  const handleRemoveCartItem = (index: number) => {
    const updated = [...orderCart];
    updated.splice(index, 1);
    setOrderCart(updated);
  };

  // Calculate Order Total
  const orderTotal = orderCart.reduce((sum, item) => sum + item.subtotal, 0);

  // Save Order to DB
  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (orderCart.length === 0) {
      setFormError('Please add at least one menu item to the order');
      return;
    }

    setIsSubmittingOrder(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orderCart,
          paymentMethod,
        }),
      });

      if (res.ok) {
        const savedOrder = await res.json();
        showToast(`Order ${savedOrder.orderNumber} saved successfully.`);
        setOrderCart([]);
        setPaymentMethod('Cash');
        fetchInitialData();
      } else {
        const errData = await res.json();
        setFormError(errData.error || 'Failed to save order');
      }
    } catch (err) {
      setFormError('Error connecting to server to save order');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Delete/Void Order
  const handleDeleteOrder = async (id: string, num: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Order ${num} voided/deleted.`);
        setDeletingOrderId(null);
        fetchInitialData();
      }
    } catch (err) {
      console.error('Failed to delete order:', err);
    }
  };

  // Compute Today's Dynamic Sales Statistics
  const todaySales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrdersCount = orders.length;
  const itemsSold = orders.reduce(
    (sum, o) => sum + o.items.reduce((iSum, i) => iSum + i.quantity, 0),
    0
  );
  const averageOrder =
    totalOrdersCount > 0
      ? parseFloat((todaySales / totalOrdersCount).toFixed(2))
      : 0;

  return (
    <div className="space-y-8">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#8B5A2B] text-[#FFF4E3] px-5 py-3 rounded-2xl shadow-2xl border border-[#F3E4CB]/40 flex items-center gap-2 text-xs font-bold animate-bounce">
          <Check className="w-4 h-4 text-[#59D98A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#24140C] p-5 rounded-2xl border border-[#4A2917] shadow-xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB] tracking-tight flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-[#8B5A2B]" />
            Daily Orders
          </h1>
          <p className="text-xs text-[#CDB99D] mt-0.5 font-medium">
            Record customer orders and track today&apos;s sales.
          </p>
        </div>

        {/* Dynamic Business Date & Export Header Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/admin/export?period=1month"
            className="inline-flex items-center gap-2 bg-[#1A0D07] hover:bg-[#341B10] text-[#FFF4E3] border border-[#4A2917] px-4 py-2 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#8B5A2B]" />
            <span>Export Excel</span>
          </Link>

          <div className="inline-flex items-center gap-2 bg-[#1A0D07] px-4 py-2 rounded-xl border border-[#4A2917] text-xs font-bold text-[#F3E4CB]">
            <Calendar className="w-4 h-4 text-[#8B5A2B]" />
            <span>{getFormattedDateDisplay()}</span>
          </div>
        </div>
      </div>

      {/* 1. TODAY'S SALES SUMMARY CARDS (Calculated dynamically) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's Sales */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
            TODAY&apos;S SALES
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-extrabold text-[#FFF4E3]">
            {isLoading ? '...' : `${todaySales} ETB`}
          </div>
          <p className="text-[10px] text-[#59D98A] font-semibold">Live calculation</p>
        </div>

        {/* Total Orders */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
            TOTAL ORDERS
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB]">
            {isLoading ? '...' : totalOrdersCount}
          </div>
          <p className="text-[10px] text-[#CDB99D]/70 font-semibold">Today&apos;s count</p>
        </div>

        {/* Items Sold */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
            ITEMS SOLD
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB]">
            {isLoading ? '...' : itemsSold}
          </div>
          <p className="text-[10px] text-[#CDB99D]/70 font-semibold">Total quantities</p>
        </div>

        {/* Average Order */}
        <div className="bg-[#24140C] rounded-2xl p-5 border border-[#4A2917] shadow-lg space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#CDB99D]">
            AVERAGE ORDER
          </div>
          <div className="text-2xl sm:text-3xl font-serif font-extrabold text-[#F3E4CB]">
            {isLoading ? '...' : `${averageOrder} ETB`}
          </div>
          <p className="text-[10px] text-[#CDB99D]/70 font-semibold">Per order average</p>
        </div>

      </div>

      {/* 2. NEW CUSTOMER ORDER ENTRY SECTION */}
      <div className="bg-[#24140C] rounded-2xl p-6 border border-[#4A2917] shadow-xl space-y-6">
        
        <div className="flex items-center justify-between border-b border-[#4A2917]/70 pb-4">
          <h2 className="text-lg font-serif font-bold text-[#F3E4CB] flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#8B5A2B]" />
            New Customer Order
          </h2>
          <span className="text-xs text-[#CDB99D] font-mono font-semibold">
            Status: Ready to record
          </span>
        </div>

        {formError && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl font-semibold">
            {formError}
          </div>
        )}

        <form onSubmit={handleSaveOrder} className="space-y-6">
          
          {/* Item Selector & Add Item Control */}
          <div className="bg-[#1A0D07] p-4 rounded-xl border border-[#4A2917] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            
            <div className="sm:col-span-8">
              <label className="block text-xs font-bold text-[#CDB99D] uppercase tracking-wider mb-1">
                Select Menu Item
              </label>
              <select
                value={selectedMenuItemId}
                onChange={(e) => setSelectedMenuItemId(e.target.value)}
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-[#24140C] border border-[#4A2917] rounded-xl text-[#F3E4CB] focus:outline-none focus:border-[#8B5A2B] font-medium"
              >
                {menuItems.length === 0 ? (
                  <option value="">No available menu items</option>
                ) : (
                  menuItems.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#24140C]">
                      {m.name} — {m.price} ETB ({m.category?.name || 'General'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="sm:col-span-4">
              <button
                type="button"
                onClick={handleAddItemToCart}
                disabled={menuItems.length === 0}
                className="w-full bg-[#4A2917] hover:bg-[#8B5A2B] text-[#FFF4E3] font-bold py-2.5 px-4 rounded-xl text-xs border border-[#8B5A2B]/60 transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4 text-[#F3E4CB]" />
                <span>+ Add Item to Order</span>
              </button>
            </div>

          </div>

          {/* Cart Items Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#CDB99D]">
              Order Items ({orderCart.length})
            </h3>

            {orderCart.length === 0 ? (
              <div className="bg-[#1A0D07]/60 rounded-xl p-8 text-center text-xs text-[#CDB99D]/60 border border-dashed border-[#4A2917]">
                No items added yet. Select a menu item above and click &quot;+ Add Item to Order&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#4A2917] text-[#CDB99D]/70 font-semibold uppercase tracking-wider">
                      <th className="pb-2 px-3">Item</th>
                      <th className="pb-2 px-3 text-center">Quantity</th>
                      <th className="pb-2 px-3">Unit Price</th>
                      <th className="pb-2 px-3">Subtotal</th>
                      <th className="pb-2 px-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#4A2917]/50">
                    {orderCart.map((cartItem, idx) => (
                      <tr key={idx} className="hover:bg-[#1A0D07]/40">
                        
                        <td className="py-3 px-3 font-serif font-bold text-[#F3E4CB]">
                          {cartItem.itemName}
                          <span className="text-[10px] text-[#CDB99D]/60 block font-sans font-normal">
                            {cartItem.categoryName}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(idx, -1)}
                              className="w-6 h-6 rounded-lg bg-[#1A0D07] text-[#F3E4CB] border border-[#4A2917] font-bold hover:bg-[#4A2917]"
                            >
                              -
                            </button>
                            <span className="font-bold text-[#FFF4E3] w-6 text-center">
                              {cartItem.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(idx, 1)}
                              className="w-6 h-6 rounded-lg bg-[#1A0D07] text-[#F3E4CB] border border-[#4A2917] font-bold hover:bg-[#4A2917]"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-[#CDB99D] font-medium">
                          {cartItem.unitPrice} ETB
                        </td>

                        <td className="py-3 px-3 font-bold text-[#FFF4E3]">
                          {cartItem.subtotal} ETB
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(idx)}
                            className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payment Method & Total Footer */}
          <div className="bg-[#1A0D07] p-5 rounded-xl border border-[#4A2917] flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Payment Method Selector */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-bold text-[#CDB99D] uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-[#8B5A2B]" />
                Payment Method:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#24140C] border border-[#4A2917] rounded-xl text-[#F3E4CB] font-bold focus:outline-none focus:border-[#8B5A2B]"
              >
                <option value="Cash">Cash</option>
                <option value="Telebirr">Telebirr</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Total & Save Action */}
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-[#CDB99D]/70">
                  ORDER TOTAL
                </div>
                <div className="text-2xl font-serif font-extrabold text-[#FFF4E3]">
                  {orderTotal} ETB
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingOrder || orderCart.length === 0}
                className="bg-[#8B5A2B] hover:bg-[#724820] text-[#FFF4E3] font-bold px-6 py-3 rounded-xl text-xs shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                {isSubmittingOrder ? (
                  <span>Saving order...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Order</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </form>

      </div>

      {/* 3. TODAY'S ORDERS TABLE (Sorted newest first) */}
      <div className="bg-[#24140C] rounded-2xl p-5 sm:p-6 border border-[#4A2917] shadow-xl space-y-4">
        
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-[#F3E4CB] flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#8B5A2B]" />
            Today&apos;s Orders
          </h2>

          <button
            onClick={fetchInitialData}
            className="p-2 bg-[#1A0D07] text-[#CDB99D] hover:text-[#F3E4CB] rounded-xl border border-[#4A2917] transition-colors text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#4A2917] text-[#CDB99D]/70 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Order #</th>
                <th className="pb-3 px-3">Time</th>
                <th className="pb-3 px-3">Items</th>
                <th className="pb-3 px-3">Payment</th>
                <th className="pb-3 px-3">Total</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A2917]/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#CDB99D]">
                    Loading today&apos;s orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#CDB99D]/70">
                    No orders recorded today yet. Use the &quot;+ New Customer Order&quot; section above to record an order.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const itemsSummary = order.items
                    .map((i) => `${i.itemName} ×${i.quantity}`)
                    .join(', ');

                  return (
                    <tr key={order.id} className="hover:bg-[#1A0D07]/40 transition-colors">
                      
                      <td className="py-3 px-3 font-mono font-bold text-[#F3E4CB]">
                        {order.orderNumber}
                      </td>

                      <td className="py-3 px-3 text-[#CDB99D]">
                        {order.orderTime}
                      </td>

                      <td className="py-3 px-3 text-[#F3E4CB] font-medium max-w-xs truncate">
                        {itemsSummary}
                      </td>

                      <td className="py-3 px-3 text-[#CDB99D]">
                        <span className="bg-[#1A0D07] px-2 py-0.5 rounded border border-[#4A2917] font-semibold text-[11px]">
                          {order.paymentMethod}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-bold text-[#FFF4E3]">
                        {order.totalAmount} ETB
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingOrder(order)}
                            className="inline-flex items-center gap-1 bg-[#4A2917] hover:bg-[#8B5A2B] text-[#FFF4E3] font-bold px-2.5 py-1 rounded-lg text-xs transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>

                          {deletingOrderId === order.id ? (
                            <button
                              onClick={() => handleDeleteOrder(order.id, order.orderNumber)}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs"
                            >
                              Confirm Void
                            </button>
                          ) : (
                            <button
                              onClick={() => setDeletingOrderId(order.id)}
                              className="bg-rose-950/60 hover:bg-rose-800 text-rose-300 font-semibold px-2.5 py-1 rounded-lg border border-rose-800/60 transition-colors"
                              title="Delete/Void Order"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* 4. VIEW ORDER RECEIPT MODAL */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#24140C] rounded-3xl p-6 sm:p-8 max-w-sm w-full border-2 border-[#8B5A2B] shadow-2xl space-y-5 text-center relative">
            
            <button
              onClick={() => setViewingOrder(null)}
              className="absolute top-4 right-4 text-[#CDB99D] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Receipt Header */}
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-full border border-[#8B5A2B] overflow-hidden mx-auto bg-[#1A0D07] p-0.5">
                <SafeImage
                  src="/logo.jpg"
                  alt="Dumerso Coffee Logo"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <h3 className="font-serif font-extrabold text-xl text-[#F3E4CB] tracking-wider uppercase">
                DUMERSO COFFEE
              </h3>
              <p className="text-xs text-[#CDB99D] font-mono font-bold">
                Order {viewingOrder.orderNumber}
              </p>
              <div className="text-[11px] text-[#CDB99D]/70 font-medium">
                {viewingOrder.orderDate} • {viewingOrder.orderTime}
              </div>
            </div>

            <div className="h-px bg-[#4A2917]" />

            {/* Receipt Itemized Table */}
            <div className="space-y-2 text-left text-xs text-[#F3E4CB]">
              {viewingOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div>
                    <div className="font-bold">{item.itemName}</div>
                    <div className="text-[10px] text-[#CDB99D]/70">
                      {item.quantity} × {item.unitPrice} ETB
                    </div>
                  </div>
                  <div className="font-bold text-[#FFF4E3]">
                    {item.subtotal} ETB
                  </div>
                </div>
              ))}
            </div>

            <div className="h-px bg-[#4A2917]" />

            {/* Payment Method & Total */}
            <div className="space-y-1 text-right">
              <div className="text-[11px] text-[#CDB99D] flex justify-between">
                <span>Payment Method:</span>
                <span className="font-bold text-[#F3E4CB]">{viewingOrder.paymentMethod}</span>
              </div>
              <div className="text-lg font-serif font-extrabold text-[#FFF4E3] flex justify-between pt-1 border-t border-[#4A2917]/50">
                <span>TOTAL:</span>
                <span>{viewingOrder.totalAmount} ETB</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setViewingOrder(null)}
                className="w-full bg-[#8B5A2B] hover:bg-[#724820] text-[#FFF4E3] font-bold py-2.5 rounded-xl text-xs shadow-lg"
              >
                Close Receipt
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
