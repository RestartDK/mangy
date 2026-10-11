interface MutationRunbacks {
  onSettled?: () => void;
  onSuccess?: () => void;
}

export const runMutation = async (
  mutation: Promise<unknown>,
  { onSettled, onSuccess }: MutationRunbacks = {}
): Promise<void> => {
  try {
    await mutation;
    onSuccess?.();
  } catch {
    // The mutation hook surfaces the failure through its own error state.
  } finally {
    onSettled?.();
  }
};
