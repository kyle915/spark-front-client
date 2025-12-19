// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "../ui/select";
// import {
//   Collapsible,
//   CollapsibleContent,
//   CollapsibleTrigger,
// } from "../ui/collapsible";
// import { SlidersHorizontal, ChevronDown } from "lucide-react";
// import DateRangePicker from "../ui/DateRangePicker";

// const distributors = [
//   "John Doe",
//   "Jane Smith",
//   "Michael Jordan",
//   "Sarah Connor",
// ];
// const rmmOptions = [
//   "John Smith",
//   "Emily Johnson",
//   "Michael Brown",
//   "Sarah Williams",
// ];
// const quarterOptions = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"];

// const FilterSection = () => {
//   return (
//     <div className="sticky top-15 z-40 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors duration-300">
//       <Collapsible className="w-full">
//         <div className="flex items-center justify-between px-4 py-3">
//           <div className="flex items-center space-x-2">
//             <SlidersHorizontal size={20} className="text-muted-foreground" />
//             <span className="text-sm font-semibold text-muted-foreground">
//               Filters
//             </span>
//           </div>
//           <CollapsibleTrigger asChild>
//             <button className="transition-transform data-[state=open]:rotate-180 cursor-pointer">
//               <ChevronDown className="text-muted-foreground" size={20} />
//             </button>
//           </CollapsibleTrigger>
//         </div>

//         <CollapsibleContent className="px-4 pb-4">
//           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
//             <Select>
//               <SelectTrigger size="sm" className="w-full">
//                 <SelectValue placeholder="Select Distributor" />
//               </SelectTrigger>
//               <SelectContent>
//                 {distributors.map((d) => (
//                   <SelectItem key={d} value={d}>
//                     {d}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>

//             <Select>
//               <SelectTrigger size="sm" className="w-full">
//                 <SelectValue placeholder="Select RMM" />
//               </SelectTrigger>
//               <SelectContent>
//                 {rmmOptions.map((rmm) => (
//                   <SelectItem key={rmm} value={rmm}>
//                     {rmm}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>

//             <Select>
//               <SelectTrigger size="sm" className="w-full">
//                 <SelectValue placeholder="Select Quarter" />
//               </SelectTrigger>
//               <SelectContent>
//                 {quarterOptions.map((q) => (
//                   <SelectItem key={q} value={q}>
//                     {q}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>

//             <DateRangePicker />
//           </div>
//         </CollapsibleContent>
//       </Collapsible>
//     </div>
//   );
// };

// export default FilterSection;
