import { useEffect, useMemo, useState, Suspense } from "react";
import Layout from "@/layout/Layout";
import { useLazyLoadQuery, useMutation } from "react-relay/hooks";
import { fetchQuery, graphql } from "react-relay";
import { useForm, useWatch, useFieldArray } from "react-hook-form";
import type { Control } from "react-hook-form";
import { Link } from "react-router";
import { CreateRecapMutation } from "@/api/mutations/CreateRecapMutation";
import { EventsQuery } from "@/api/queries/EventsQuery";
import { JobsQuery } from "@/api/queries/JobsQuery";
import { RetailersQuery } from "@/api/queries/RetailersQuery";
import { JobAmbassadorsQuery } from "@/api/queries/JobAmbassadorsQuery";
import { ProductsQuery } from "@/api/queries/ProductsQuery";
import { ProductTypesQuery } from "@/api/queries/ProductTypesQuery";
import { TypeOfGoodsQuery } from "@/api/queries/TypeOfGoodsQuery";

import { FileTypesQuery } from "@/api/queries/FileTypesQuery";
import { FileRecapCategoriesQuery } from "@/api/queries/FileRecapCategoriesQuery";

import type { CreateRecapMutation as CreateRecapMutationType } from "@api/mutations/__generated__/CreateRecapMutation.graphql";
import type { FileTypesQuery as FileTypesQueryType } from "@/api/queries/__generated__/FileTypesQuery.graphql";
import type { FileRecapCategoriesQuery as FileRecapCategoriesQueryType } from "@/api/queries/__generated__/FileRecapCategoriesQuery.graphql";
import type { EventsQuery as EventsQueryType } from "@/api/queries/__generated__/EventsQuery.graphql";
import type { JobsQuery as JobsQueryType } from "@/api/queries/__generated__/JobsQuery.graphql";
import type { RetailersQuery as RetailersQueryType } from "@/api/queries/__generated__/RetailersQuery.graphql";
import type { JobAmbassadorsQuery as JobAmbassadorsQueryType } from "@/api/queries/__generated__/JobAmbassadorsQuery.graphql";
import type { ProductsQuery as ProductsQueryType } from "@/api/queries/__generated__/ProductsQuery.graphql";
import type { ProductTypesQuery as ProductTypesQueryType } from "@/api/queries/__generated__/ProductTypesQuery.graphql";
import type { TypeOfGoodsQuery as TypeOfGoodsQueryType } from "@/api/queries/__generated__/TypeOfGoodsQuery.graphql";
import type { GraphQLTaggedNode } from "react-relay";

import FormInputText from "@shared/FormInputText";
import FormAutocomplete from "@shared/FormAutocomplete";
import Loading from "@shared/Loading";

import { useAuthStore } from "@/store/authStore";
import { useAlertStore } from "@/store/alertStore";

import environment from "@/api/relay/environment";

import {
  ArrowLeftIcon,
  PencilIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import FormTextarea from "@/shared/FormTextarea";
import FileUploadItem from "@/shared/FileUploadItem";

/* ───────────────────────────────────────────── */
/* TYPES */
/* ───────────────────────────────────────────── */

type FileItem = {
  id: number;
  file: File | null;
  fileTypeId: string;
  fileRecapCategoryId: string;
};

type ConsumerEngagementsFormValues = {
  totalConsumer: string;
  firstTimeConsumers: string;
  brandAwareConsumers: string;
  willingToPurchaseConsumers: string;
  notWillingConsumers: string;
};

type ProductSampleFormValues = {
  productId: string;
  quantity: string;
};

type SalesPerformanceFormValues = {
  productId: string;
  typeOfGoodId: string;
  price: string;
};

type ConsumerFeedbackFormValues = {
  demographics: string;
  feedback: string;
  quotes: string;
  positiveStories: string;
  reasonsToDecline: string;
};

type AccountFeedbackFormValues = {
  feedback: string;
  doDifferentlyFeedback: string;
  corpoCard: string;
};

type RecapFormValues = {
  name: string;
  tenantId: string;
  eventId: string;
  jobId: string;
  retailerId: string;
  ambassadorId: string;
  productsSold: string;
  totalEarnings: string;
  consumerEngagements: ConsumerEngagementsFormValues;
  productSamples: ProductSampleFormValues[];
  salesPerformance: SalesPerformanceFormValues[];
  consumerFeedback: ConsumerFeedbackFormValues;
  accountFeedback: AccountFeedbackFormValues;
};

/* ───────────────────────────────────────────── */
/* EVENT SELECT */
/* ───────────────────────────────────────────── */

type EventSelectProps = {
  tenantId: string;
  control: Control<RecapFormValues>;
  onRetailerResolved?: (retailerId: string | null) => void;
};

const EventSelect = ({
  tenantId,
  control,
  onRetailerResolved,
}: EventSelectProps) => {
  const eventsData = useLazyLoadQuery<EventsQueryType>(
    EventsQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const selectedEventId = useWatch({ control, name: "eventId" });

  const eventOptions = useMemo(
    () =>
      eventsData.events.edges.map((edge) => ({
        value: edge.node.id,
        label: `${edge.node.name}${
          edge.node.startTime
            ? ` - ${new Date(edge.node.startTime).toLocaleDateString()}`
            : ""
        }`,
      })),
    [eventsData]
  );

  useEffect(() => {
    if (!onRetailerResolved) return;

    if (!selectedEventId) {
      onRetailerResolved(null);
      return;
    }

    const matched = eventsData.events.edges.find(
      (edge) => edge.node.id === selectedEventId
    );

    onRetailerResolved(matched?.node?.request?.retailer?.id ?? null);
  }, [eventsData.events.edges, onRetailerResolved, selectedEventId]);

  return (
    <FormAutocomplete
      control={control}
      name="eventId"
      label="Event"
      placeholder="Search event..."
      options={eventOptions}
      rules={{ required: "Event is required" }}
    />
  );
};

/* ───────────────────────────────────────────── */
/* JOB SELECT */
/* ───────────────────────────────────────────── */

type JobSelectProps = {
  tenantId: string;
  eventId: string;
  control: Control<RecapFormValues>;
};

const JobSelect = ({ tenantId, eventId, control }: JobSelectProps) => {
  const jobsData = useLazyLoadQuery<JobsQueryType>(
    JobsQuery,
    { first: 100, filters: { tenantId, eventId } },
    { fetchPolicy: "store-and-network" }
  );

  const jobOptions = useMemo(
    () =>
      (jobsData.jobs?.edges ?? [])
        .map((edge) => edge?.node)
        .filter(Boolean)
        .map((node) => ({
          value: node!.id,
          label: `${node!.name}${node!.code ? ` (${node!.code})` : ""}`,
        })),
    [jobsData.jobs?.edges]
  );

  return (
    <FormAutocomplete
      control={control}
      name="jobId"
      label="Job"
      placeholder="Search job..."
      options={jobOptions}
      rules={{ required: "Job is required" }}
      disabled={jobOptions.length === 0}
    />
  );
};

/* ───────────────────────────────────────────── */
/* MAIN */
/* ───────────────────────────────────────────── */

const CreateRecap = () => {
  const { tenantId } = useAuthStore();
  const { showAlert } = useAlertStore();
  const [commitCreateRecap, isInFlight] =
    useMutation<CreateRecapMutationType>(CreateRecapMutation);

  const [loading, setLoading] = useState(false);
  const [fileItems, setFileItems] = useState<FileItem[]>([
    { id: 0, file: null, fileTypeId: "", fileRecapCategoryId: "" },
  ]);
  const [nextFileId, setNextFileId] = useState(1);

  const { control, handleSubmit, setValue, reset } = useForm<RecapFormValues>({
    defaultValues: {
      name: "",
      eventId: "",
      jobId: "",
      retailerId: "",
      ambassadorId: "",
      productsSold: "",
      totalEarnings: "",
      consumerEngagements: {
        totalConsumer: "",
        firstTimeConsumers: "",
        brandAwareConsumers: "",
        willingToPurchaseConsumers: "",
        notWillingConsumers: "",
      },
      productSamples: [],
      salesPerformance: [],
      consumerFeedback: {
        demographics: "",
        feedback: "",
        quotes: "",
        positiveStories: "",
        reasonsToDecline: "",
      },
      accountFeedback: {
        feedback: "",
        doDifferentlyFeedback: "",
        corpoCard: "",
      },
    },
  });

  const selectedEventId = useWatch({ control, name: "eventId" });
  const selectedJobId = useWatch({ control, name: "jobId" });
  const productSamplesWatch = useWatch({ control, name: "productSamples" });
  const salesPerformanceWatch = useWatch({ control, name: "salesPerformance" });

  /* ───────── Retailers ───────── */

  const retailersData = useLazyLoadQuery<RetailersQueryType>(
    RetailersQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const retailerOptions = useMemo(
    () =>
      (retailersData.retailers?.edges ?? []).map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    [retailersData.retailers?.edges]
  );

  /* ───────── Ambassadors ───────── */

  const [ambassadorOptions, setAmbassadorOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  useEffect(() => {
    if (!selectedJobId) {
      setAmbassadorOptions([]);
      setValue("ambassadorId", "");
      return;
    }

    fetchQuery<JobAmbassadorsQueryType>(environment, JobAmbassadorsQuery, {
      jobId: selectedJobId,
      first: 50,
    })
      .toPromise()
      .then((data) => {
        const seen = new Set<string>();
        const opts: Array<{ value: string; label: string }> = [];

        (data?.jobApplicants?.edges ?? []).forEach((edge) => {
          const a = edge?.node?.ambassador;
          if (!a || seen.has(a.id)) return;
          seen.add(a.id);
          const label = `${a.user?.firstName ?? ""} ${
            a.user?.lastName ?? ""
          }`.trim();
          opts.push({ value: a.id, label: label || a.id });
        });

        setAmbassadorOptions(opts);
      })
      .catch(() => {
        showAlert("Error loading ambassadors", "error");
        setAmbassadorOptions([]);
      });
  }, [selectedJobId, setValue, showAlert]);

  useEffect(() => {
    setValue("jobId", "");
    setValue("ambassadorId", "");
  }, [selectedEventId, setValue]);

  const handleRetailerResolved = (retailerId: string | null) => {
    setValue("retailerId", retailerId ?? "");
  };

  /* ───────── Products / Types / Goods ───────── */
  const productsData = useLazyLoadQuery<ProductsQueryType>(
    ProductsQuery,
    { first: 100, filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const productTypesData = useLazyLoadQuery<ProductTypesQueryType>(
    ProductTypesQuery,
    { filters: { tenantId } },
    { fetchPolicy: "store-and-network" }
  );

  const typeOfGoodsData = useLazyLoadQuery<TypeOfGoodsQueryType>(
    TypeOfGoodsQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const productNodes = useMemo(
    () =>
      (productsData.products?.edges ?? []).map((e) => e.node).filter(Boolean),
    [productsData.products?.edges]
  );

  const productTypeOptions = useMemo(
    () =>
      (productTypesData.productTypes?.edges ?? []).map((e) => ({
        value: e.node.id,
        label: e.node.name,
      })),
    [productTypesData.productTypes?.edges]
  );

  const typeOfGoodOptions = useMemo(
    () =>
      (typeOfGoodsData.typeOfGoods?.edges ?? []).map((e) => ({
        value: e.node.id,
        label: e.node.name,
      })),
    [typeOfGoodsData.typeOfGoods?.edges]
  );

  /* ───────── Product Samples  ───────── */
  const { append: appendSample, remove: removeSample } = useFieldArray({
    control,
    name: "productSamples",
  });

  const [sampleTypeFilter, setSampleTypeFilter] = useState("");

  const filteredSampleProducts = useMemo(() => {
    if (!sampleTypeFilter) return productNodes;
    return productNodes.filter((p) => p.productType?.id === sampleTypeFilter);
  }, [productNodes, sampleTypeFilter]);

  const toggleSampleProduct = (productId: string) => {
    const idx =
      productSamplesWatch?.findIndex((p) => p.productId === productId) ?? -1;

    if (idx >= 0) {
      removeSample(idx);
    } else {
      appendSample({ productId, quantity: "" });
    }
  };

  /* ───────── Sales Performance  ───────── */

  const { append: appendSale, remove: removeSale } = useFieldArray({
    control,
    name: "salesPerformance",
  });

  const [salesTypeFilter, setSalesTypeFilter] = useState("");

  const filteredSalesProducts = useMemo(() => {
    if (!salesTypeFilter) return productNodes;
    return productNodes.filter((p) => p.productType?.id === salesTypeFilter);
  }, [productNodes, salesTypeFilter]);

  const toggleSaleProduct = (productId: string) => {
    const idx =
      salesPerformanceWatch?.findIndex((p) => p.productId === productId) ?? -1;

    if (idx >= 0) {
      removeSale(idx);
    } else {
      appendSale({ productId, typeOfGoodId: "", price: "" });
    }
  };

  /* ───────── Files ───────── */
  const fileTypesData = useLazyLoadQuery<FileTypesQueryType>(
    FileTypesQuery,
    {},
    { fetchPolicy: "store-and-network" }
  );

  const fileRecapCategoriesData =
    useLazyLoadQuery<FileRecapCategoriesQueryType>(
      FileRecapCategoriesQuery,
      { filters: { tenantId } },
      { fetchPolicy: "store-and-network" }
    );

  const fileTypeOptions = useMemo(
    () =>
      fileTypesData.fileTypes.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.extension
          ? `${edge.node.name} (.${edge.node.extension})`
          : edge.node.name,
      })),
    [fileTypesData]
  );

  const fileRecapCategoryOptions = useMemo(
    () =>
      fileRecapCategoriesData.fileRecapCategories.edges.map((edge) => ({
        value: edge.node.id,
        label: edge.node.name,
      })),
    [fileRecapCategoriesData]
  );

  const handleFileSelected = (file: File | null, index: number) => {
    setFileItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, file } : item))
    );
  };

  const handleFileTypeSelected = (fileTypeId: string, index: number) => {
    setFileItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, fileTypeId } : item))
    );
  };

  const handleFileRecapCategorySelected = (
    fileRecapCategoryId: string,
    index: number
  ) => {
    setFileItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, fileRecapCategoryId } : item
      )
    );
  };

  const handleRemoveFile = (index: number) => {
    if (fileItems.length === 1) {
      setFileItems([
        { id: nextFileId, file: null, fileTypeId: "", fileRecapCategoryId: "" },
      ]);
      setNextFileId(nextFileId + 1);
    } else {
      setFileItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleAddFile = () => {
    setFileItems((prev) => [
      ...prev,
      { id: nextFileId, file: null, fileTypeId: "", fileRecapCategoryId: "" },
    ]);
    setNextFileId(nextFileId + 1);
  };

  const handleFileError = (error: string) => {
    showAlert(error, "error");
  };

  const GetUploadUrlQuery: GraphQLTaggedNode = graphql`
    query CreateRecap_GetUploadUrlQuery(
      $filePath: String!
      $contentType: String!
    ) {
      getUploadUrl(filePath: $filePath, contentType: $contentType) {
        uploadUrl
        blobName
      }
    }
  `;

  type GetUploadUrlQueryType = {
    response: {
      getUploadUrl: {
        uploadUrl: string;
        blobName: string;
      } | null;
    };
    variables: {
      filePath: string;
      contentType: string;
    };
  };

  const uploadFile = async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `recaps/${timestamp}_${file.name}`;

    const uploadData = await fetchQuery<GetUploadUrlQueryType>(
      environment,
      GetUploadUrlQuery,
      {
        filePath: fileName,
        contentType: file.type,
      }
    ).toPromise();

    const uploadUrl = uploadData?.getUploadUrl?.uploadUrl;
    const blobName = uploadData?.getUploadUrl?.blobName;

    if (!uploadUrl || !blobName) {
      throw new Error("Unable to get upload URL.");
    }

    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!res.ok) {
      throw new Error(`Failed to upload file: ${file.name}`);
    }

    return blobName;
  };

  const uploadAllFiles = async (): Promise<{
    uploadedFiles: string[];
    fileRecapCategoryId: string | null;
  }> => {
    const filesToUpload = fileItems.filter((item) => item.file !== null);

    if (filesToUpload.length === 0) {
      throw new Error("Please select at least one file to upload.");
    }

    const missingType = filesToUpload.find((item) => !item.fileTypeId);
    if (missingType) {
      throw new Error("Please select a file type for each file.");
    }

    const missingCategory = filesToUpload.find(
      (item) => !item.fileRecapCategoryId
    );
    if (missingCategory) {
      throw new Error("Please select a recap category for each file.");
    }

    const categorySet = new Set(
      filesToUpload.map((item) => item.fileRecapCategoryId)
    );
    if (categorySet.size > 1) {
      throw new Error("Please select a single recap category for all files.");
    }

    const fileRecapCategoryId = categorySet.values().next().value ?? null;
    const uploadPromises = filesToUpload.map(async (item) =>
      uploadFile(item.file!)
    );
    const uploadedFiles = await Promise.all(uploadPromises);
    return { uploadedFiles, fileRecapCategoryId };
  };

  const buildConsumerEngagements = (
    data: RecapFormValues
  ):
    | CreateRecapMutationType["variables"]["input"]["consumerEngagements"]
    | null => {
    const parsed = {
      totalConsumer: toIntegerOrNull(data.consumerEngagements.totalConsumer),
      firstTimeConsumers: toIntegerOrNull(
        data.consumerEngagements.firstTimeConsumers
      ),
      brandAwareConsumers: toIntegerOrNull(
        data.consumerEngagements.brandAwareConsumers
      ),
      willingToPurchaseConsumers: toIntegerOrNull(
        data.consumerEngagements.willingToPurchaseConsumers
      ),
      notWillingConsumers: toIntegerOrNull(
        data.consumerEngagements.notWillingConsumers
      ),
    };

    const hasAny = Object.values(parsed).some((v) => v !== null);
    if (!hasAny) return null;

    const hasNull = Object.values(parsed).some((v) => v === null);
    if (hasNull) {
      throw new Error(
        "Complete all Consumer Engagement fields or leave them empty."
      );
    }

    // 🔑 AQUÍ está la clave
    return {
      totalConsumer: parsed.totalConsumer!,
      firstTimeConsumers: parsed.firstTimeConsumers!,
      brandAwareConsumers: parsed.brandAwareConsumers!,
      willingToPurchaseConsumers: parsed.willingToPurchaseConsumers!,
      notWillingConsumers: parsed.notWillingConsumers!,
    };
  };

  const buildProductSamples = (
    data: RecapFormValues
  ): CreateRecapMutationType["variables"]["input"]["productSamples"] | null => {
    const mapped = data.productSamples.map((s) => ({
      productId: s.productId,
      quantity: toIntegerOrNull(s.quantity),
    }));

    const hasAny = mapped.some((s) => s.productId || s.quantity !== null);

    if (!hasAny) return null;

    const invalid = mapped.some(
      (s) =>
        (s.productId || s.quantity !== null) &&
        (!s.productId || s.quantity === null)
    );

    if (invalid) {
      throw new Error(
        "Complete product samples with product and quantity or remove them."
      );
    }

    return mapped
      .filter(
        (s): s is { productId: string; quantity: number } =>
          Boolean(s.productId) && s.quantity !== null
      )
      .map((s) => ({
        productId: s.productId,
        quantity: s.quantity,
      }));
  };

  const buildSalesPerformance = (
    data: RecapFormValues
  ):
    | CreateRecapMutationType["variables"]["input"]["salesPerformance"]
    | null => {
    const mapped = data.salesPerformance.map((s) => ({
      productId: s.productId,
      typeOfGoodId: s.typeOfGoodId,
      price: toNumberOrNull(s.price),
    }));

    const hasAny = mapped.some(
      (s) => s.productId || s.typeOfGoodId || s.price !== null
    );

    if (!hasAny) return null;

    const invalid = mapped.some(
      (s) =>
        (s.productId || s.typeOfGoodId || s.price !== null) &&
        (!s.productId || !s.typeOfGoodId || s.price === null)
    );

    if (invalid) {
      throw new Error(
        "Complete sales performance rows or remove incomplete ones."
      );
    }

    return mapped
      .filter(
        (
          s
        ): s is {
          productId: string;
          typeOfGoodId: string;
          price: number;
        } => Boolean(s.productId) && Boolean(s.typeOfGoodId) && s.price !== null
      )
      .map((s) => ({
        productId: s.productId,
        typeOfGoodId: s.typeOfGoodId,
        price: s.price,
      }));
  };

  const buildConsumerFeedback = (formData: RecapFormValues) => {
    const consumerFeedback = {
      demographics: trimToNull(formData.consumerFeedback.demographics),
      feedback: trimToNull(formData.consumerFeedback.feedback),
      quotes: trimToNull(formData.consumerFeedback.quotes),
      positiveStories: trimToNull(formData.consumerFeedback.positiveStories),
      reasonsToDecline: trimToNull(formData.consumerFeedback.reasonsToDecline),
    };

    const hasAny = Object.values(consumerFeedback).some((value) => value);
    return hasAny ? consumerFeedback : null;
  };

  const buildAccountFeedback = (data: RecapFormValues) => {
    const fb = {
      feedback: trimToNull(data.accountFeedback.feedback),
      doDifferentlyFeedback: trimToNull(
        data.accountFeedback.doDifferentlyFeedback
      ),
      corpoCard: trimToNull(data.accountFeedback.corpoCard),
    };

    return Object.values(fb).some(Boolean) ? fb : null;
  };

  const toNumberOrNull = (value: string | number | null | undefined) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const toIntegerOrNull = (value: string | number | null | undefined) => {
    const n = toNumberOrNull(value);
    return n === null ? null : Math.trunc(n);
  };

  const trimToNull = (value?: string | null) => {
    if (!value) return null;
    const v = value.trim();
    return v === "" ? null : v;
  };

  /* ───────── Submit ───────── */

  const onSubmit = async (formData: RecapFormValues) => {
    setLoading(true);
    let uploadedFiles: string[] = [];
    let fileRecapCategoryId: string | null = null;

    try {
      const uploadResult = await uploadAllFiles();
      uploadedFiles = uploadResult.uploadedFiles;
      fileRecapCategoryId = uploadResult.fileRecapCategoryId;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error uploading files.";
      showAlert(message, "error");
      setLoading(false);
      return;
    }

    let consumerEngagementsInput:
      | CreateRecapMutationType["variables"]["input"]["consumerEngagements"]
      | null = null;
    let productSamplesInput: CreateRecapMutationType["variables"]["input"]["productSamples"] =
      null;
    let salesPerformanceInput: CreateRecapMutationType["variables"]["input"]["salesPerformance"] =
      null;

    try {
      consumerEngagementsInput = buildConsumerEngagements(formData);
      productSamplesInput = buildProductSamples(formData);
      salesPerformanceInput = buildSalesPerformance(formData);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Please review the recap data.";
      showAlert(message, "error");
      setLoading(false);
      return;
    }

    const consumerFeedbackInput = buildConsumerFeedback(formData);
    const accountFeedbackInput = buildAccountFeedback(formData);
    const productsSoldValue = toIntegerOrNull(formData.productsSold);
    const totalEarningsValue = toNumberOrNull(formData.totalEarnings);

    const input: CreateRecapMutationType["variables"]["input"] = {
      name: formData.name,
      eventId: formData.eventId,
      files: uploadedFiles,
    };

    const jobIdValue = formData.jobId?.trim();
    const retailerIdValue = formData.retailerId?.trim();
    const ambassadorIdValue = formData.ambassadorId?.trim();

    if (productsSoldValue !== null) input.productsSold = productsSoldValue;
    if (totalEarningsValue !== null) input.totalEarnings = totalEarningsValue;
    if (consumerEngagementsInput)
      input.consumerEngagements = consumerEngagementsInput;
    if (productSamplesInput?.length) input.productSamples = productSamplesInput;
    if (salesPerformanceInput?.length)
      input.salesPerformance = salesPerformanceInput;
    if (consumerFeedbackInput) input.consumerFeedback = consumerFeedbackInput;
    if (accountFeedbackInput) input.accountFeedback = accountFeedbackInput;
    if (jobIdValue) input.jobId = jobIdValue;
    if (retailerIdValue) input.retailerId = retailerIdValue;
    if (ambassadorIdValue) input.ambassadorId = ambassadorIdValue;
    if (fileRecapCategoryId) input.fileRecapCategoryId = fileRecapCategoryId;

    console.log("INPUT", input);
    commitCreateRecap({
      variables: {
        input,
      },
      onCompleted: (response) => {
        const createRecapResponse = response.createRecap;

        if (createRecapResponse?.success) {
          showAlert(createRecapResponse.message, "success");
          reset({
            name: "",
            tenantId: tenantId || "",
            eventId: "",
            jobId: "",
            retailerId: "",
            ambassadorId: "",
            productsSold: "",
            totalEarnings: "",
            consumerEngagements: {
              totalConsumer: "",
              firstTimeConsumers: "",
              brandAwareConsumers: "",
              willingToPurchaseConsumers: "",
              notWillingConsumers: "",
            },
            productSamples: [{ productId: "", quantity: "" }],
            salesPerformance: [{ productId: "", typeOfGoodId: "", price: "" }],
            consumerFeedback: {
              demographics: "",
              feedback: "",
              quotes: "",
              positiveStories: "",
              reasonsToDecline: "",
            },
            accountFeedback: {
              feedback: "",
              doDifferentlyFeedback: "",
              corpoCard: "",
            },
          });
          setFileItems([
            {
              id: nextFileId,
              file: null,
              fileTypeId: "",
              fileRecapCategoryId: "",
            },
          ]);
          setNextFileId(nextFileId + 1);
        } else {
          showAlert(
            createRecapResponse?.message ?? "Error creating recap",
            "error"
          );
        }
        setLoading(false);
      },
      onError: (error) => {
        showAlert(`Error creating recap: ${error.message}`, "error");
        setLoading(false);
      },
    });
  };

  /* ───────────────────────────── */

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)} className="w-full">
        <div className="w-full rounded-3xl bg-base-200/80 border border-base-100/30 shadow-2xl backdrop-blur-sm">
          <div className="p-8 md:p-10 space-y-8">
            {/* ===================================================== */}
            {/* HEADER */}
            {/* ===================================================== */}
            <div className="flex flex-col gap-5 border-b border-base-100/20 pb-4">
              <div className="flex items-center justify-between gap-4">
                <Link
                  to="/recap/list"
                  className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  Back to list
                </Link>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 text-3xl font-bold text-primary text-shadow-2xs text-shadow-primary-100">
                    <PencilIcon className="w-6 h-6" />
                    <h1>Create Recap</h1>
                  </span>
                </div>
                <p className="text-base-content/70 text-sm mt-2">
                  Fill out the form below to create a new recap.
                </p>
              </div>
            </div>

            {/* ===================================================== */}
            {/* BASIC INFO */}
            {/* ===================================================== */}
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Basic Information</p>
                <span className="text-xs text-base-content/60">
                  Required fields
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormInputText
                  control={control}
                  name="name"
                  label="Recap Name"
                  placeholder="e.g., Event Recap June 2024"
                  rules={{
                    required: "Recap name is required",
                    minLength: {
                      value: 2,
                      message: "Recap name must be at least 2 characters",
                    },
                  }}
                />
              </div>
            </section>

            {/* ===================================================== */}
            {/* BLOCK 1: ASSIGNMENT */}
            {/* ===================================================== */}
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <p className="font-semibold text-lg">Assignment</p>

              <div className="grid gap-4 md:grid-cols-2">
                <Suspense fallback={<Loading />}>
                  <EventSelect
                    tenantId={tenantId || ""}
                    control={control}
                    onRetailerResolved={handleRetailerResolved}
                  />
                </Suspense>

                {selectedEventId ? (
                  <Suspense fallback={<Loading />}>
                    <JobSelect
                      tenantId={tenantId || ""}
                      eventId={selectedEventId}
                      control={control}
                    />
                  </Suspense>
                ) : (
                  <FormAutocomplete
                    control={control}
                    name="jobId"
                    label="Job"
                    options={[]}
                    placeholder="Select an event first"
                    disabled
                  />
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormAutocomplete
                  control={control}
                  name="retailerId"
                  label="Retailer"
                  placeholder={
                    selectedEventId
                      ? "Select retailer..."
                      : "Select an event first"
                  }
                  options={retailerOptions}
                  disabled={retailerOptions.length === 0}
                />

                <FormAutocomplete
                  control={control}
                  name="ambassadorId"
                  label="Ambassador"
                  placeholder={
                    selectedJobId
                      ? "Select ambassador..."
                      : "Select a job first"
                  }
                  options={ambassadorOptions}
                  disabled={ambassadorOptions.length === 0 || !selectedJobId}
                />
              </div>
            </section>

            {/* ===================================================== */}
            {/* BLOCK 2: SALES METRICS */}
            {/* ===================================================== */}
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <p className="font-semibold text-lg">Sales Metrics</p>

              <div className="grid gap-4 md:grid-cols-2">
                <FormInputText
                  control={control}
                  name="productsSold"
                  label="Products Sold"
                  type="number"
                  placeholder="Total units sold"
                  rules={{
                    min: { value: 0, message: "Must be zero or greater" },
                  }}
                />

                <FormInputText
                  control={control}
                  name="totalEarnings"
                  label="Total Earnings"
                  type="number"
                  placeholder="Total earnings"
                  rules={{
                    min: { value: 0, message: "Must be zero or greater" },
                  }}
                />
              </div>
            </section>

            {/* ===================================================== */}
            {/* BLOCK 3: CONSUMER ENGAGEMENT */}
            {/* ===================================================== */}
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <p className="font-semibold text-lg">Consumer Engagement</p>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <FormInputText
                  control={control}
                  name="consumerEngagements.totalConsumer"
                  label="Total Consumers"
                  type="number"
                  rules={{
                    min: { value: 0, message: "Must be zero or greater" },
                  }}
                />

                <FormInputText
                  control={control}
                  name="consumerEngagements.firstTimeConsumers"
                  label="First Time Consumers"
                  type="number"
                  rules={{
                    min: { value: 0, message: "Must be zero or greater" },
                  }}
                />

                <FormInputText
                  control={control}
                  name="consumerEngagements.brandAwareConsumers"
                  label="Brand Aware Consumers"
                  type="number"
                  rules={{
                    min: { value: 0, message: "Must be zero or greater" },
                  }}
                />

                <FormInputText
                  control={control}
                  name="consumerEngagements.willingToPurchaseConsumers"
                  label="Willing To Purchase"
                  type="number"
                  rules={{
                    min: { value: 0, message: "Must be zero or greater" },
                  }}
                />

                <FormInputText
                  control={control}
                  name="consumerEngagements.notWillingConsumers"
                  label="Not Willing To Purchase"
                  type="number"
                  rules={{
                    min: { value: 0, message: "Must be zero or greater" },
                  }}
                />
              </div>
            </section>

            {/* ===================================================== */}
            {/* BLOCK 4: PRODUCT SAMPLES */}
            {/* ===================================================== */}
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Product Samples</p>
                <p className="text-sm text-base-content/70">
                  Select the products sampled and provide quantities.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <label className="text-sm font-medium">
                  Filter by Product Type:
                </label>
                <select
                  className="select select-bordered select-sm w-48"
                  value={sampleTypeFilter}
                  onChange={(e) => setSampleTypeFilter(e.target.value)}
                >
                  <option value="">All Product Types</option>
                  {productTypeOptions.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSampleProducts.map((product) => {
                  const idx =
                    productSamplesWatch?.findIndex(
                      (p) => p.productId === product.id
                    ) ?? -1;
                  const selected = idx >= 0;

                  return (
                    <div
                      key={product.id}
                      className={`rounded-2xl border p-4 bg-base-100 transition hover:shadow-lg cursor-pointer ${
                        selected
                          ? "border-primary shadow-primary/30"
                          : "border-base-300"
                      }`}
                      onClick={() => toggleSampleProduct(product.id)}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-24 h-24 bg-base-200 rounded-xl flex items-center justify-center overflow-hidden">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-base-content/60">
                              No image
                            </span>
                          )}
                        </div>

                        <div className="text-center space-y-1">
                          <p className="font-semibold">{product.name}</p>
                          {product.productType?.name ? (
                            <p className="text-xs text-base-content/70">
                              {product.productType.name}
                            </p>
                          ) : null}
                        </div>

                        {selected ? (
                          <div
                            className="w-full"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FormInputText
                              control={control}
                              name={`productSamples.${idx}.quantity`}
                              label="Quantity"
                              type="number"
                              rules={{
                                min: {
                                  value: 0,
                                  message: "Must be zero or greater",
                                },
                              }}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSampleProduct(product.id);
                            }}
                          >
                            Select
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===================================================== */}
            {/* BLOCK 5: SALES PERFORMANCE */}
            {/* ===================================================== */}
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Sales Performance</p>
                <p className="text-sm text-base-content/70">
                  Select the SKUs sold and provide details.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <label className="text-sm font-medium">
                  Filter by Product Type:
                </label>
                <select
                  className="select select-bordered select-sm w-48"
                  value={salesTypeFilter}
                  onChange={(e) => setSalesTypeFilter(e.target.value)}
                >
                  <option value="">All Product Types</option>
                  {productTypeOptions.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSalesProducts.map((product) => {
                  const idx =
                    salesPerformanceWatch?.findIndex(
                      (p) => p.productId === product.id
                    ) ?? -1;
                  const selected = idx >= 0;

                  return (
                    <div
                      key={product.id}
                      className={`rounded-2xl border p-4 bg-base-100 transition hover:shadow-lg cursor-pointer ${
                        selected
                          ? "border-primary shadow-primary/30"
                          : "border-base-300"
                      }`}
                      onClick={() => toggleSaleProduct(product.id)}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-24 h-24 bg-base-200 rounded-xl flex items-center justify-center overflow-hidden">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-base-content/60">
                              No image
                            </span>
                          )}
                        </div>

                        <div className="text-center space-y-1">
                          <p className="font-semibold">{product.name}</p>
                          {product.productType?.name ? (
                            <p className="text-xs text-base-content/70">
                              {product.productType.name}
                            </p>
                          ) : null}
                        </div>

                        {selected ? (
                          <div
                            className="w-full space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FormAutocomplete
                              control={control}
                              name={`salesPerformance.${idx}.typeOfGoodId`}
                              label="Type of Good"
                              placeholder="Select type of good"
                              options={typeOfGoodOptions}
                              disabled={typeOfGoodOptions.length === 0}
                            />

                            <FormInputText
                              control={control}
                              name={`salesPerformance.${idx}.price`}
                              label="Price"
                              type="number"
                              rules={{
                                min: {
                                  value: 0,
                                  message: "Must be zero or greater",
                                },
                              }}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSaleProduct(product.id);
                            }}
                          >
                            Select
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===================================================== */}
            {/* BLOCK 6: FEEDBACK */}
            {/* ===================================================== */}
            <section className="space-y-6 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-lg">Feedback</p>
                <p className="text-sm text-base-content/70">
                  Provide detailed feedback from consumers and account.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
                {/* ================= Consumer Feedback ================= */}
                <div className="space-y-3">
                  <h3 className="text-md font-semibold">Consumer Feedback</h3>

                  <FormTextarea
                    control={control}
                    name="consumerFeedback.feedback"
                    placeholder=""
                    label="General Feedback"
                    rows={3}
                  />

                  <FormTextarea
                    control={control}
                    name="consumerFeedback.quotes"
                    placeholder=""
                    label="Quotes"
                    rows={2}
                  />

                  <FormTextarea
                    control={control}
                    name="consumerFeedback.positiveStories"
                    placeholder=""
                    label="Positive Stories"
                    rows={2}
                  />

                  <FormTextarea
                    control={control}
                    name="consumerFeedback.reasonsToDecline"
                    placeholder=""
                    label="Reasons to Decline"
                    rows={2}
                  />

                  <FormTextarea
                    control={control}
                    name="consumerFeedback.demographics"
                    placeholder=""
                    label="Demographics"
                    rows={2}
                  />
                </div>
                {/**Separtor */}
                <div className="w-px bg-base-100/20 mx-4 hidden md:block"></div>

                {/* ================= Account Feedback ================= */}
                <div className="space-y-3">
                  <h3 className="text-md font-semibold">Account Feedback</h3>

                  <FormTextarea
                    control={control}
                    name="accountFeedback.feedback"
                    placeholder=""
                    label="Account Feedback"
                    rows={3}
                  />

                  <FormTextarea
                    control={control}
                    name="accountFeedback.doDifferentlyFeedback"
                    placeholder=""
                    label="What would you do differently?"
                    rows={2}
                  />

                  <FormTextarea
                    control={control}
                    name="accountFeedback.corpoCard"
                    placeholder=""
                    label="Corporate Card Notes"
                    rows={2}
                  />
                </div>
              </div>
            </section>

            {/* ===================================================== */}
            {/* BLOCK 7: FILES */}
            {/* ===================================================== */}
            <section className="space-y-4 rounded-2xl bg-base-300/60 border border-base-100/20 p-6">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-lg">Files</label>
                <span className="text-xs text-base-content/60">
                  Upload evidences and documents
                </span>
              </div>

              <div className="space-y-3">
                {fileItems.map((item, index) => (
                  <FileUploadItem
                    key={item.id}
                    index={index}
                    fileTypeOptions={fileTypeOptions}
                    fileRecapCategoryOptions={fileRecapCategoryOptions}
                    fileTypeId={item.fileTypeId}
                    fileRecapCategoryId={item.fileRecapCategoryId}
                    onFileSelected={handleFileSelected}
                    onFileTypeSelected={handleFileTypeSelected}
                    onFileRecapCategorySelected={
                      handleFileRecapCategorySelected
                    }
                    onRemove={handleRemoveFile}
                    onError={handleFileError}
                  />
                ))}
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm mt-3 flex items-center gap-2"
                onClick={handleAddFile}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Another File
              </button>
            </section>

            {/* ===================================================== */}
            {/* ACTIONS */}
            {/* ===================================================== */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <Link className="btn btn-sm btn-outline" to="/recap/list">
                <XCircleIcon className="w-4 h-4" />
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={loading || isInFlight}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </form>
    </Layout>
  );
};

export default CreateRecap;
