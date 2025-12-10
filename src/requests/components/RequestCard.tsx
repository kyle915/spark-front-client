import React from "react";
import { Link } from "react-router";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import type { RequestUuidQuery$data } from "@api/queries/__generated__/RequestUuidQuery.graphql";
import LocationMap from "@shared/LocationMap";
import { formatDate, formatTime } from "@utils/index"

type Request = NonNullable<RequestUuidQuery$data["request"]>;

interface Props {
    request: Request;
}

const RequestCard: React.FC<Props> = ({ request }) => {
    return (
        <div className="w-full rounded-3xl bg-base-200/80 text-base-content border border-base-100/30 shadow-2xl backdrop-blur-sm">
            <div className="p-8 md:p-10 space-y-8">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-base-100/20">
                    <div>
                        <p className="text-xs uppercase tracking-[0.5em] text-base-content/40">Request Details</p>
                        <h1 className="text-3xl font-semibold mt-1">{request.name ?? "Untitled Request"}</h1>
                        <p className="text-base-content/70 text-sm mt-2">
                            Review the details of the sampling request for{" "}
                            <span className="font-semibold">{request.retailer?.name ?? "this account"}</span>.
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <Link to={`/request/edit/${request.uuid}`} className="btn btn-sm btn-ghost gap-2 border border-base-content/20">
                            <PencilSquareIcon className="w-4 h-4" />
                            Edit
                        </Link>
                        <div className="flex items-center gap-3">
                            <span className="badge badge-lg badge-primary">{request.status?.name ?? "Not status"}</span>
                            {request.requestType?.name && <span className="badge badge-outline">{request.requestType.name}</span>}
                        </div>
                    </div>
                </div>

                {/* BASIC INFORMATION */}
                <div className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
                    <div className="flex items-center justify-between">
                        <p className="font-semibold text-lg">Basic Information</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-5">
                            <div>
                                <p className="text-xs uppercase opacity-60">Address</p>
                                <p className="font-medium">{request.address}</p>
                            </div>

                            <div>
                                <p className="text-xs uppercase opacity-60">Date</p>
                                <p className="font-medium">{formatDate(request.date ?? null)}</p>
                            </div>

                            <div>
                                <p className="text-xs uppercase opacity-60">Start Time</p>
                                <p className="font-medium">{formatTime(request.startTime ?? null)}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase opacity-60">Timezone</p>
                                <p className="font-medium">
                                    {request.timezone ? (
                                        <>
                                            {request.timezone.name}-{request.timezone.code} (UTC
                                            {(() => {
                                                const offset = request.timezone.offset;
                                                const sign = offset >= 0 ? '+' : '-';
                                                const absOffsetMinutes = Math.abs(offset);
                                                const hours = Math.floor(absOffsetMinutes / 60);
                                                const minutes = absOffsetMinutes % 60;
                                                return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                                            })()})
                                        </>
                                    ) : "No timezone"}
                                </p>
                            </div>

                        </div>

                        <div className="space-y-5">
                            <div>
                                <p className="text-xs uppercase opacity-60">Account Name</p>
                                <p className="font-medium">{request.retailer?.name ?? "Unknown account"}</p>
                            </div>

                            <div>
                                <p className="text-xs uppercase opacity-60">Distributor</p>
                                <p className="font-medium">{request.distributor?.name ?? "Unknown distributor"}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase opacity-60">End Time</p>
                                <p className="font-medium">{formatTime(request.endTime ?? null)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* REQUEST DETAILS */}
                <div className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
                    <p className="font-semibold text-lg">Request Details</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <p className="text-xs uppercase opacity-60">Request Type</p>
                            <p className="font-medium">{request.requestType?.name ?? "Unknown type"}</p>
                        </div>

                        <div>
                            <p className="text-xs uppercase opacity-60">Status</p>
                            <p className="font-medium">{request.status?.name ?? "Not status"}</p>
                        </div>
                    </div>
                </div>

                {/* LOCATION MAP */}
                <div className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
                    <div className="flex items-center justify-between">
                        <p className="font-semibold text-lg">Location</p>
                        <div className="text-xs text-base-content/70">
                            {request.coordinates
                                ? `${request.coordinates[0]?.toString() ?? "-"}, ${request.coordinates[1]?.toString() ?? "-"}`
                                : "No coordinates provided"}
                        </div>
                    </div>
                    <LocationMap
                        coordinates={request.coordinates ?? null}
                        label={request.name ?? "Request Location"}
                        address={request.address ?? null}
                    />
                </div>
            </div>

            {/* FOOTER */}
            <div className="mx-8 mb-8 opacity-60 text-sm">
                Last updated:{" "}
                {new Date(request.updatedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                })}
            </div>
        </div>
    );
};

export default RequestCard;
