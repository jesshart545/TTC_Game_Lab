"use client";
import { useEffect, useRef, type ReactNode } from "react";

export default function AssetDetailsDialog({label,children,onClose}:{label:string;children:ReactNode;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;if(element&&!element.open)element.showModal();},[]);
 return <dialog ref={dialog} className="asset-details-dialog" aria-label={label} onCancel={onClose} onClose={onClose}>{children}</dialog>;
}
