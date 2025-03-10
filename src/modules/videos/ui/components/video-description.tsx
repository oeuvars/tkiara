import { cn } from '@/lib/utils';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useState } from 'react'

type Props = {
   compactViews: string;
   expandedViews: string;
   compactDate: string;
   expandedDate: string;
   description: string | null;
}

const VideoDescription = ({ compactDate, expandedViews, compactViews, expandedDate, description }: Props) => {

   const [isExpanded, setIsExpanded] = useState<boolean>(false);


   return (
      <div onClick={() => setIsExpanded((current) => !current)} className='bg-zinc-200/50 rounded-xl p-3 cursor-pointer hover:bg-zinc/70 transition'>
         <div className='flex gap-2 text-sm mb-2'>
            <span className='font-semibold'>
               {isExpanded ? expandedViews : compactViews} &nbsp;views
            </span>
            <span className='font-medium text-zinc-500'>
               {isExpanded ? expandedDate : compactDate}
            </span>
         </div>
         <div className='relative'>
            <p className={cn("text-sm whitespace-pre-wrap", !isExpanded && "line-clamp-2")}>
               {description || "No description"}
            </p>
            <div className='flex items-center gap-1 mt-4 text-sm font-medium'>
               {isExpanded ? <>Show less <IconChevronUp className='size-4'/></> : <>Show More <IconChevronDown className='size-4'/></>}
            </div>
         </div>
      </div>
   )
}

export default VideoDescription
