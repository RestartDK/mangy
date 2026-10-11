import { toast } from "sonner";

import { getErrorMessage } from "@/lib/format";

interface MutationMessages {
  failure: string;
  success: string;
}

export const notifyMutation = async (
  mutation: Promise<unknown>,
  { failure, success }: MutationMessages
): Promise<boolean> => {
  try {
    await mutation;
    toast.success(success);
    return true;
  } catch (error) {
    toast.error(getErrorMessage(error, failure));
    return false;
  }
};
