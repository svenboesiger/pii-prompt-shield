/**
 * MarketingCloudEmailActionTest
 *
 * Unit tests for MarketingCloudEmailAction.
 * Uses a mock HTTP callout so no real network request is made.
 */
@IsTest
private class MarketingCloudEmailActionTest {

    // -----------------------------------------------------------------------
    // Mock HTTP callout
    // -----------------------------------------------------------------------

    private class SfmcSuccessMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HTTPResponse res = new HTTPResponse();
            res.setStatusCode(202);
            res.setBody('{"requestId":"mock-request-id","errorcode":0,"responses":[]}');
            return res;
        }
    }

    private class SfmcErrorMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HTTPResponse res = new HTTPResponse();
            res.setStatusCode(400);
            res.setBody('{"message":"Bad Request","errorcode":10000}');
            return res;
        }
    }

    // -----------------------------------------------------------------------
    // Helper
    // -----------------------------------------------------------------------

    private static MarketingCloudEmailAction.EmailRequest buildRequest(Boolean useJourney) {
        MarketingCloudEmailAction.EmailRequest req = new MarketingCloudEmailAction.EmailRequest();
        req.toAddress            = 'test@example.com';
        req.firstName            = 'Ada';
        req.lastName             = 'Lovelace';
        req.contactKey           = 'contact-key-001';
        req.definitionKey        = 'WelcomeEmailDefinition';
        req.useJourneyEntry      = useJourney;
        req.customAttributesJson = '{"OrderId":"ORD-9999"}';
        return req;
    }

    // -----------------------------------------------------------------------
    // Tests – Transactional Send
    // -----------------------------------------------------------------------

    @IsTest
    static void testTransactionalSend_Success() {
        Test.setMock(HttpCalloutMock.class, new SfmcSuccessMock());
        Test.startTest();
        List<MarketingCloudEmailAction.EmailResult> results =
            MarketingCloudEmailAction.sendEmails(
                new List<MarketingCloudEmailAction.EmailRequest>{ buildRequest(false) }
            );
        Test.stopTest();

        System.assertEquals(1, results.size(), 'Should return exactly one result');
        System.assert(results[0].success, 'Expected success for 202 response');
        System.assertEquals(202, results[0].statusCode, 'Status code should be 202');
    }

    @IsTest
    static void testTransactionalSend_Error() {
        Test.setMock(HttpCalloutMock.class, new SfmcErrorMock());
        Test.startTest();
        List<MarketingCloudEmailAction.EmailResult> results =
            MarketingCloudEmailAction.sendEmails(
                new List<MarketingCloudEmailAction.EmailRequest>{ buildRequest(false) }
            );
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assert(!results[0].success, 'Expected failure for 400 response');
        System.assertEquals(400, results[0].statusCode);
    }

    // -----------------------------------------------------------------------
    // Tests – Journey Entry Event
    // -----------------------------------------------------------------------

    @IsTest
    static void testJourneyEntryEvent_Success() {
        Test.setMock(HttpCalloutMock.class, new SfmcSuccessMock());
        Test.startTest();
        List<MarketingCloudEmailAction.EmailResult> results =
            MarketingCloudEmailAction.sendEmails(
                new List<MarketingCloudEmailAction.EmailRequest>{ buildRequest(true) }
            );
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assert(results[0].success, 'Expected success for journey entry 202 response');
    }

    // -----------------------------------------------------------------------
    // Tests – Bulk (multiple requests in one invocation)
    // -----------------------------------------------------------------------

    @IsTest
    static void testBulkInvocation() {
        Test.setMock(HttpCalloutMock.class, new SfmcSuccessMock());
        List<MarketingCloudEmailAction.EmailRequest> requests =
            new List<MarketingCloudEmailAction.EmailRequest>{
                buildRequest(false),
                buildRequest(true)
            };

        Test.startTest();
        List<MarketingCloudEmailAction.EmailResult> results =
            MarketingCloudEmailAction.sendEmails(requests);
        Test.stopTest();

        System.assertEquals(2, results.size(), 'Should return two results for two requests');
        for (MarketingCloudEmailAction.EmailResult r : results) {
            System.assert(r.success);
        }
    }

    // -----------------------------------------------------------------------
    // Tests – Invalid custom attributes JSON (should not throw)
    // -----------------------------------------------------------------------

    @IsTest
    static void testInvalidCustomAttributesJson() {
        Test.setMock(HttpCalloutMock.class, new SfmcSuccessMock());
        MarketingCloudEmailAction.EmailRequest req = buildRequest(false);
        req.customAttributesJson = 'NOT_VALID_JSON';

        Test.startTest();
        List<MarketingCloudEmailAction.EmailResult> results =
            MarketingCloudEmailAction.sendEmails(
                new List<MarketingCloudEmailAction.EmailRequest>{ req }
            );
        Test.stopTest();

        // Should still succeed; bad JSON is silently ignored
        System.assertEquals(1, results.size());
        System.assert(results[0].success, 'Should still succeed despite bad JSON attributes');
    }

    // -----------------------------------------------------------------------
    // Tests – Null optional fields
    // -----------------------------------------------------------------------

    @IsTest
    static void testNullOptionalFields() {
        Test.setMock(HttpCalloutMock.class, new SfmcSuccessMock());
        MarketingCloudEmailAction.EmailRequest req = new MarketingCloudEmailAction.EmailRequest();
        req.toAddress     = 'minimal@example.com';
        req.contactKey    = 'contact-min';
        req.definitionKey = 'MinimalDefinition';
        // firstName, lastName, customAttributesJson, useJourneyEntry all null

        Test.startTest();
        List<MarketingCloudEmailAction.EmailResult> results =
            MarketingCloudEmailAction.sendEmails(
                new List<MarketingCloudEmailAction.EmailRequest>{ req }
            );
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assert(results[0].success);
    }
}
