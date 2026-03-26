/**
 * MarketingCloudEmailAction
 *
 * Invocable Apex action for use in Salesforce Screen Flows.
 * Triggers a Salesforce Marketing Cloud (SFMC) Transactional Send or
 * fires a Journey Builder entry event via the SFMC REST API.
 *
 * Prerequisites:
 *  1. A Named Credential named "SFMC_API" pointing to your SFMC REST Base URI
 *     (e.g. https://YOUR_SUBDOMAIN.rest.marketingcloudapis.com)
 *     with OAuth 2.0 client-credential authentication already configured.
 *  2. In SFMC, create a Transactional Send Definition and note its definitionKey,
 *     OR create a Journey with an API Entry Source and note its eventDefinitionKey.
 *  3. Add the Named Credential endpoint to Remote Site Settings.
 */
public with sharing class MarketingCloudEmailAction {

    // -----------------------------------------------------------------------
    // Input / Output wrappers
    // -----------------------------------------------------------------------

    public class EmailRequest {
        @InvocableVariable(label='Recipient Email Address' required=true)
        public String toAddress;

        @InvocableVariable(label='Recipient First Name')
        public String firstName;

        @InvocableVariable(label='Recipient Last Name')
        public String lastName;

        @InvocableVariable(label='Contact Key (Subscriber Key)' required=true)
        public String contactKey;

        /**
         * For Transactional Send: the definitionKey of the Send Definition.
         * For Journey API: the eventDefinitionKey of the Journey entry event.
         * Required for whichever mode you are using.
         */
        @InvocableVariable(label='SFMC Definition Key / Event Definition Key' required=true)
        public String definitionKey;

        /**
         * Set to true to use Journey Builder API entry event.
         * Set to false (default) to use Transactional Messaging API.
         */
        @InvocableVariable(label='Use Journey Entry Event? (true/false)')
        public Boolean useJourneyEntry;

        /** Optional: JSON string of additional attribute key-value pairs, e.g. {"OrderId":"12345"} */
        @InvocableVariable(label='Custom Attributes JSON')
        public String customAttributesJson;
    }

    public class EmailResult {
        @InvocableVariable(label='Success')
        public Boolean success;

        @InvocableVariable(label='Message / Error Detail')
        public String message;

        @InvocableVariable(label='HTTP Status Code')
        public Integer statusCode;
    }

    // -----------------------------------------------------------------------
    // Invocable entry point
    // -----------------------------------------------------------------------

    @InvocableMethod(
        label       = 'Send Marketing Cloud Email'
        description = 'Triggers a Transactional Send or Journey entry event in Salesforce Marketing Cloud.'
        category    = 'Marketing Cloud'
    )
    public static List<EmailResult> sendEmails(List<EmailRequest> requests) {
        List<EmailResult> results = new List<EmailResult>();
        for (EmailRequest req : requests) {
            results.add(processSingleRequest(req));
        }
        return results;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private static EmailResult processSingleRequest(EmailRequest req) {
        EmailResult result = new EmailResult();
        try {
            if (req.useJourneyEntry == true) {
                result = fireJourneyEntryEvent(req);
            } else {
                result = sendTransactionalEmail(req);
            }
        } catch (Exception ex) {
            result.success    = false;
            result.message    = 'Apex exception: ' + ex.getMessage();
            result.statusCode = 0;
        }
        return result;
    }

    /**
     * Transactional Messaging API
     * POST /messaging/v1/email/messages/{messageKey}
     * https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/sendMessageSingleRecipient.html
     */
    private static EmailResult sendTransactionalEmail(EmailRequest req) {
        String messageKey = generateMessageKey();
        String endpoint   = 'callout:SFMC_API/messaging/v1/email/messages/' + messageKey;

        Map<String, Object> recipient = new Map<String, Object>{
            'contactKey' => req.contactKey,
            'to'         => req.toAddress,
            'attributes' => buildAttributes(req)
        };

        Map<String, Object> body = new Map<String, Object>{
            'definitionKey' => req.definitionKey,
            'recipient'     => recipient
        };

        return callSfmcApi('POST', endpoint, JSON.serialize(body));
    }

    /**
     * Journey Builder – API Entry Event
     * POST /interaction/v1/events
     * https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/postEvent.html
     */
    private static EmailResult fireJourneyEntryEvent(EmailRequest req) {
        String endpoint = 'callout:SFMC_API/interaction/v1/events';

        Map<String, Object> data = buildAttributes(req);

        Map<String, Object> body = new Map<String, Object>{
            'ContactKey'          => req.contactKey,
            'EventDefinitionKey'  => req.definitionKey,
            'Data'                => data
        };

        return callSfmcApi('POST', endpoint, JSON.serialize(body));
    }

    /** Merges standard name fields with any extra custom attributes. */
    private static Map<String, Object> buildAttributes(EmailRequest req) {
        Map<String, Object> attrs = new Map<String, Object>();
        if (String.isNotBlank(req.firstName))  { attrs.put('FirstName', req.firstName); }
        if (String.isNotBlank(req.lastName))   { attrs.put('LastName',  req.lastName);  }
        if (String.isNotBlank(req.toAddress))  { attrs.put('EmailAddress', req.toAddress); }

        if (String.isNotBlank(req.customAttributesJson)) {
            try {
                Map<String, Object> extra =
                    (Map<String, Object>) JSON.deserializeUntyped(req.customAttributesJson);
                attrs.putAll(extra);
            } catch (JSONException je) {
                // Swallow parse error; custom attrs are optional
            }
        }
        return attrs;
    }

    /** Makes an HTTP callout to SFMC and maps the response to an EmailResult. */
    private static EmailResult callSfmcApi(String method, String endpoint, String requestBody) {
        EmailResult result = new EmailResult();

        HttpRequest httpReq = new HttpRequest();
        httpReq.setMethod(method);
        httpReq.setEndpoint(endpoint);
        httpReq.setHeader('Content-Type', 'application/json');
        httpReq.setBody(requestBody);
        httpReq.setTimeout(30000);

        HttpResponse httpRes = new Http().send(httpReq);

        result.statusCode = httpRes.getStatusCode();
        result.success    = (httpRes.getStatusCode() >= 200 && httpRes.getStatusCode() < 300);
        result.message    = httpRes.getBody();

        return result;
    }

    /** Generates a unique message key for idempotent Transactional API sends. */
    private static String generateMessageKey() {
        return EncodingUtil.convertToHex(Crypto.generateAesKey(128)).substring(0, 32);
    }
}
