'use client';

import { useState, useEffect } from 'react';
import {
  Client,
  createClient,
  updateClient,
} from '@/lib/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X } from 'lucide-react';

interface ClientFormModalProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ClientFormModal({
  client,
  open,
  onOpenChange,
  onSuccess,
}: ClientFormModalProps) {
  const isEditing = !!client;

  // Form state
  const [name, setName] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [accountManager, setAccountManager] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract folder ID from URL if pasted
  const extractFolderIdFromInput = (input: string): string => {
    // Check if it's a Drive URL
    const urlMatch = input.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    // Otherwise assume it's a folder ID
    return input.trim();
  };

  // Initialize form when client changes
  useEffect(() => {
    if (client && open) {
      setName(client.name || '');
      setDomains(client.domains || []);
      setKeywords(client.keywords || []);
      setAccountManager(client.account_manager || '');
      setDriveFolderId(client.drive_folder_id || '');
      setStatus(client.status || 'active');
    } else if (!client && open) {
      // Reset form for new client
      setName('');
      setDomains([]);
      setKeywords([]);
      setAccountManager('');
      setDriveFolderId('');
      setStatus('active');
    }
    setError(null);
    setNewDomain('');
    setNewKeyword('');
  }, [client, open]);

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    const domain = newDomain.trim().toLowerCase();
    if (domains.includes(domain)) {
      setError('This domain is already added');
      return;
    }
    setDomains([...domains, domain]);
    setNewDomain('');
    setError(null);
  };

  const handleRemoveDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain));
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    const keyword = newKeyword.trim().toLowerCase();
    if (keywords.includes(keyword)) {
      setError('This keyword is already added');
      return;
    }
    setKeywords([...keywords, keyword]);
    setNewKeyword('');
    setError(null);
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Client name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Build clientData without undefined values (Firestore doesn't accept undefined)
      const clientData: Record<string, any> = {
        name: name.trim(),
        status,
      };
      // Only add optional fields if they have values
      if (domains.length > 0) clientData.domains = domains;
      if (keywords.length > 0) clientData.keywords = keywords;
      if (accountManager.trim()) clientData.account_manager = accountManager.trim();
      if (driveFolderId.trim()) clientData.drive_folder_id = driveFolderId.trim();

      if (isEditing && client) {
        await updateClient(client.id, clientData);
      } else {
        await createClient(clientData as Omit<Client, 'id'>);
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save client:', err);
      setError('Failed to save client. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the client information below.'
              : 'Create a new client to organize meeting notes.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Client Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Acme Corporation"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Email Domains</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., acme.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDomain();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddDomain}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {domains.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {domains.map((domain) => (
                  <Badge
                    key={domain}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleRemoveDomain(domain)}
                  >
                    {domain}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Email domains help auto-classify meetings with this client
            </p>
          </div>

          <div className="space-y-2">
            <Label>Keywords</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., project-alpha"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleRemoveKeyword(keyword)}
                  >
                    {keyword}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Keywords in meeting titles help identify client meetings
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountManager">Account Manager</Label>
            <Input
              id="accountManager"
              type="email"
              placeholder="manager@egen.ai"
              value={accountManager}
              onChange={(e) => setAccountManager(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="driveFolderId">Google Drive Folder ID or URL</Label>
            <Input
              id="driveFolderId"
              placeholder="Paste folder URL or ID (e.g., 1abc...xyz)"
              value={driveFolderId}
              onChange={(e) => setDriveFolderId(extractFolderIdFromInput(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Paste the Google Drive folder URL or ID where client notes should be moved
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v: 'active' | 'inactive') => setStatus(v)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive p-2 rounded bg-destructive/10">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Add Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
